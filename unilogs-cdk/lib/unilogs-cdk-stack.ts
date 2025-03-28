import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as msk from 'aws-cdk-lib/aws-msk';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { KubectlV31Layer as KubectlLayer } from '@aws-cdk/lambda-layer-kubectl-v31';

export class UnilogsCdkStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ==================== VPC CONFIGURATION ====================
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
    new cdk.CfnOutput(this, 'VpcId', { value: vpc.vpcId });

    // ==================== MSK KAFKA CLUSTER ====================
    const mskSecurityGroup = new ec2.SecurityGroup(this, 'MskSecurityGroup', {
      vpc,
      description: 'Security group for MSK cluster',
      allowAllOutbound: true,
    });
    mskSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcpRange(9092, 9098),
      'Allow from EKS pods'
    );

    const mskCluster = new msk.CfnCluster(this, 'UniLogsKafka', {
      clusterName: 'unilogs-kafka',
      kafkaVersion: '3.6.0',
      numberOfBrokerNodes: 2,
      brokerNodeGroupInfo: {
        instanceType: 'kafka.m5.large',
        clientSubnets: vpc.selectSubnets({
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }).subnetIds,
        securityGroups: [mskSecurityGroup.securityGroupId],
        storageInfo: {
          ebsStorageInfo: {
            volumeSize: 100, // GB
          },
        },
      },
      clientAuthentication: {
        unauthenticated: {
          enabled: true, // For testing (production should use TLS)
        },
      },
      encryptionInfo: {
        encryptionInTransit: {
          clientBroker: 'PLAINTEXT', // For testing (production should use TLS)
        },
      },
    });

    // Custom resource to get MSK brokers
    const mskBrokersRole = new iam.Role(this, 'MskBrokersRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });
    mskBrokersRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['kafka:GetBootstrapBrokers', 'kafka:DescribeCluster'],
        resources: [mskCluster.attrArn],
      })
    );

    const mskBrokers = new cr.AwsCustomResource(this, 'MskBootstrapBrokers', {
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
      onCreate: {
        service: 'Kafka',
        action: 'getBootstrapBrokers',
        parameters: {
          ClusterArn: mskCluster.attrArn,
        },
        physicalResourceId: cr.PhysicalResourceId.of('MskBootstrapBrokers'),
      },
      role: mskBrokersRole,
    });
    new cdk.CfnOutput(this, 'KafkaBootstrapServers', {
      value: mskBrokers.getResponseField('BootstrapBrokerString'),
    });

    // ==================== EKS CLUSTER ====================
    const cluster = new eks.FargateCluster(this, 'FargateCluster', {
      vpc,
      version: eks.KubernetesVersion.V1_32,
      kubectlLayer: new KubectlLayer(this, 'kubectl'),
      clusterName: 'unilogs-cluster',
    });

    // IAM permissions for EKS to access MSK
    cluster.awsAuth.addRoleMapping(
      new iam.Role(this, 'KafkaAccessRole', {
        assumedBy: new iam.ServicePrincipal('eks.amazonaws.com'),
        inlinePolicies: {
          mskAccess: new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                actions: ['kafka:DescribeCluster', 'kafka:GetBootstrapBrokers'],
                resources: [mskCluster.attrArn],
              }),
            ],
          }),
        },
      }),
      {
        groups: ['system:masters'],
      }
    );

    // ==================== LOKI STORAGE ====================
    const timestamp = new Date().getTime();

    const lokiChunkBucket = new s3.Bucket(this, 'LokiChunkBucket', {
      bucketName: `unilogs-loki-chunk-${this.account}-${this.region}-${cdk.Names.uniqueId(this).toLowerCase()}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      autoDeleteObjects: true, // First empties the bucket
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Then deletes bucket
    });

    const lokiRulerBucket = new s3.Bucket(this, 'LokiRulerBucket', {
      bucketName: `unilogs-loki-ruler-${this.account}-${this.region}-${cdk.Names.uniqueId(this).toLowerCase()}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      autoDeleteObjects: true, // First empties the bucket
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Then deletes bucket
    });

    const lokiAdminBucket = new s3.Bucket(this, 'LokiAdminBucket', {
      bucketName: `unilogs-loki-admin-${this.account}-${this.region}-${cdk.Names.uniqueId(this).toLowerCase()}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      autoDeleteObjects: true, // First empties the bucket
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Then deletes bucket
    });

    // IAM role for Loki pods
    const lokiRole = new iam.Role(this, 'LokiRole', {
      assumedBy: new iam.ServicePrincipal('eks.amazonaws.com'),
      inlinePolicies: {
        lokiS3Access: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: [
                's3:ListBucket',
                's3:PutObject',
                's3:GetObject',
                's3:DeleteObject',
              ],
              resources: [
                lokiChunkBucket.bucketArn,
                `${lokiChunkBucket.bucketArn}/*`,
                lokiRulerBucket.bucketArn,
                `${lokiRulerBucket.bucketArn}/*`,
                lokiAdminBucket.bucketArn,
                `${lokiAdminBucket.bucketArn}/*`,
              ],
            }),
          ],
        }),
      },
    });
    cluster.awsAuth.addRoleMapping(lokiRole, {
      groups: ['system:masters'],
      username: 'loki-s3-user',
    });

    // ==================== LOKI DEPLOYMENT ====================
    const lokiChart = cluster.addHelmChart('LokiScalable', {
      chart: 'loki',
      repository: 'https://grafana.github.io/helm-charts',
      namespace: 'loki',
      createNamespace: true,
      version: '5.42.1',
      values: {
        loki: {
          schemaConfig: {
            configs: [
              {
                from: '2024-04-01',
                store: 'tsdb',
                object_store: 's3',
                schema: 'v13',
                index: {
                  prefix: 'loki_index_',
                  period: '24h',
                },
              },
            ],
          },
          storage_config: {
            aws: {
              region: this.region,
              s3: `s3://${lokiChunkBucket.bucketName}`,
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
            retention_period: '672h', // 28 days
          },
        },
        deploymentMode: 'SimpleScalable',
        backend: {
          replicas: 2,
          persistence: {
            storageClass: 'gp2',
            size: '10Gi',
          },
        },
        read: {
          replicas: 2,
          persistence: {
            storageClass: 'gp2',
            size: '10Gi',
          },
        },
        write: {
          replicas: 3,
          persistence: {
            storageClass: 'gp2',
            size: '10Gi',
          },
        },
        minio: {
          enabled: false,
        },
        gateway: {
          enabled: false, // Disabled in favor of custom service
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

    // Custom Gateway Service with NLB
    const lokiGatewayService = cluster.addManifest('LokiGatewayService', {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: 'loki-gateway',
        namespace: 'loki',
        labels: { app: 'loki', component: 'gateway' },
        annotations: {
          'service.beta.kubernetes.io/aws-load-balancer-type': 'nlb',
          'service.beta.kubernetes.io/aws-load-balancer-healthcheck-healthy-threshold':
            '2',
          'service.beta.kubernetes.io/aws-load-balancer-healthcheck-unhealthy-threshold':
            '2',
          'service.beta.kubernetes.io/aws-load-balancer-healthcheck-interval':
            '10',
        },
      },
      spec: {
        type: 'LoadBalancer',
        ports: [{ port: 80, targetPort: 80, protocol: 'TCP' }],
        selector: { app: 'loki', component: 'gateway' },
      },
    });
    lokiGatewayService.node.addDependency(lokiChart);

    // ==================== DEPENDENCIES ====================
    lokiChart.node.addDependency(
      lokiChunkBucket,
      lokiRulerBucket,
      lokiAdminBucket,
      mskCluster
    );
    cluster.node.addDependency(mskCluster);

    // ==================== OUTPUTS ====================
    new cdk.CfnOutput(this, 'ClusterName', { value: cluster.clusterName });
    new cdk.CfnOutput(this, 'LokiGatewayEndpoint', {
      value: `http://loki-gateway.loki.svc.cluster.local`,
      description: 'Internal DNS name for Loki Gateway',
    });
    new cdk.CfnOutput(this, 'LokiGatewayExternalCommand', {
      value:
        'kubectl get svc loki-gateway -n loki -o jsonpath="{.status.loadBalancer.ingress[0].hostname}"',
      description: 'Command to get external Loki Gateway endpoint',
    });
    new cdk.CfnOutput(this, 'ValidationCommand', {
      value:
        'kubectl -n loki logs -l app.kubernetes.io/instance=loki -c distributor | grep "msg="starting component"',
      description: 'Command to verify Loki components started',
    });
  }
}
