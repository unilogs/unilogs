import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { KubectlV31Layer as KubectlLayer } from '@aws-cdk/lambda-layer-kubectl-v31';

export class UnilogsCdkStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a VPC with 2 AZs for high availability
    const vpc = new ec2.Vpc(this, 'UniLogsVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // Output the VPC ID for reference
    new cdk.CfnOutput(this, 'VpcId', { value: vpc.vpcId });

    // Create the EKS Fargate Cluster with kubectl layer
    const cluster = new eks.FargateCluster(this, 'FargateCluster', {
      vpc,
      version: eks.KubernetesVersion.V1_32,
      kubectlLayer: new KubectlLayer(this, 'kubectl'),
      clusterName: 'unilogs-cluster',
    });

    // SIMPLIFIED: Using single S3 bucket for all Loki storage
    const lokiStorageBucket = new s3.Bucket(this, 'LokiStorageBucket', {
      bucketName: `unilogs-loki-storage-${this.account}-${this.region}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });

    // PROTECTION: Prevent accidental deletion during testing
    lokiStorageBucket.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);

    // Create IAM policy for Loki to access S3
    const lokiS3Policy = new iam.PolicyDocument({
      statements: [
        new iam.PolicyStatement({
          actions: [
            's3:ListBucket',
            's3:PutObject',
            's3:GetObject',
            's3:DeleteObject',
          ],
          resources: [
            lokiStorageBucket.bucketArn,
            `${lokiStorageBucket.bucketArn}/*`,
          ],
        }),
      ],
    });

    // Create IAM role for Loki pods
    const lokiRole = new iam.Role(this, 'LokiRole', {
      assumedBy: new iam.ServicePrincipal('eks.amazonaws.com'),
      inlinePolicies: {
        lokiS3Access: lokiS3Policy,
      },
    });

    // Add the role to EKS aws-auth config
    cluster.awsAuth.addRoleMapping(lokiRole, {
      groups: ['system:masters'],
      username: 'loki-s3-user',
    });

    // Deploy Loki in simple scalable mode with S3 storage
    const lokiChart = cluster.addHelmChart('LokiScalable', {
      chart: 'loki',
      repository: 'https://grafana.github.io/helm-charts',
      namespace: 'loki',
      createNamespace: true,
      version: '5.42.1',
      values: {
        loki: {
          schemaConfig: {
            configs: [{
              from: '2024-04-01',
              store: 'tsdb',
              object_store: 's3',
              schema: 'v13',
              index: {
                prefix: 'loki_index_',
                period: '24h',
              },
            }],
          },
          storage_config: {
            aws: {
              region: this.region,
              s3: `s3://${lokiStorageBucket.bucketName}`,
              s3forcepathstyle: false,
            },
          },
          ingester: {
            chunk_encoding: 'snappy',
          },
          querier: {
            max_concurrent: 4,
          },
          pattern_ingester: {
            enabled: true,
          },
          limits_config: {
            allow_structured_metadata: true,
            volume_enabled: true,
            retention_period: '672h', // 28 days retention
          },
        },
        deploymentMode: 'SimpleScalable',
        backend: {
          replicas: 1,
          persistence: {
            storageClass: 'gp2',
            size: '10Gi',
          },
        },
        read: {
          replicas: 1,
          persistence: {
            storageClass: 'gp2',
            size: '10Gi',
          },
        },
        write: {
          replicas: 1,
          persistence: {
            storageClass: 'gp2',
            size: '10Gi',
          },
        },
        minio: {
          enabled: false,
        },
        gateway: {
          enabled: true,
          service: {
            type: 'LoadBalancer',
            annotations: {
              'service.beta.kubernetes.io/aws-load-balancer-type': 'nlb',
              // HEALTH CHECKS: Added LB health check configuration
              'service.beta.kubernetes.io/aws-load-balancer-healthcheck-healthy-threshold': '2',
              'service.beta.kubernetes.io/aws-load-balancer-healthcheck-unhealthy-threshold': '2',
              'service.beta.kubernetes.io/aws-load-balancer-healthcheck-interval': '10',
            },
          },
        },
        serviceAccount: {
          create: true,
          name: 'loki-service-account',
          annotations: {
            'eks.amazonaws.com/role-arn': lokiRole.roleArn,
          },
        },
      },
    });

    // Make Loki depend on the bucket
    lokiChart.node.addDependency(lokiStorageBucket);

    // Outputs
    new cdk.CfnOutput(this, 'ClusterName', { value: cluster.clusterName });
    new cdk.CfnOutput(this, 'LokiGatewayEndpoint', {
      value: `http://loki-gateway.loki.svc.cluster.local`,
      description: 'Internal DNS name for Loki Gateway',
    });
    new cdk.CfnOutput(this, 'LokiGatewayExternalCommand', {
      value: 'kubectl get svc loki-gateway -n loki -o jsonpath="{.status.loadBalancer.ingress[0].hostname}"',
      description: 'Command to get external Loki Gateway endpoint',
    });
    new cdk.CfnOutput(this, 'LokiBucketName', {
      value: lokiStorageBucket.bucketName,
      description: 'S3 bucket used for Loki storage',
    });
  }
}