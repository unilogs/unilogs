import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as msk from 'aws-cdk-lib/aws-msk';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { KubectlV32Layer as KubectlLayer } from '@aws-cdk/lambda-layer-kubectl-v32';

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
        sasl: {
          iam: {
            enabled: true, // Enable IAM auth
          },
        },
      },
      encryptionInfo: {
        encryptionInTransit: {
          clientBroker: 'TLS', // For production
          inCluster: true,
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

    // ==================== EKS CLUSTER ====================
    const clusterAdminRole = new iam.Role(this, 'ClusterAdminRole', {
      assumedBy: new iam.AccountRootPrincipal(),
      description: 'Role for cluster administration',
    });

    const cluster = new eks.FargateCluster(this, 'FargateCluster', {
      vpc,
      version: eks.KubernetesVersion.V1_32,
      kubectlLayer: new KubectlLayer(this, 'kubectl'),
      clusterName: 'unilogs-cluster',
      mastersRole: clusterAdminRole,
      outputConfigCommand: true,
    });

    // Explicitly map your IAM user
    cluster.awsAuth.addUserMapping(
      iam.User.fromUserArn(
        this,
        'MyUser',
        `arn:aws:iam::${this.account}:user/UnilogsAdmin`
      ),
      {
        groups: ['system:masters'],
        username: 'admin',
      }
    );

    // Map the admin role
    cluster.awsAuth.addRoleMapping(clusterAdminRole, {
      groups: ['system:masters'],
      username: 'cdk-admin',
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
    const lokiChunkBucket = new s3.Bucket(this, 'LokiChunkBucket', {
      bucketName: `unilogs-loki-chunk-${this.account}-${
        this.region
      }-${cdk.Names.uniqueId(this).toLowerCase()}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
    });

    const lokiRulerBucket = new s3.Bucket(this, 'LokiRulerBucket', {
      bucketName: `unilogs-loki-ruler-${this.account}-${
        this.region
      }-${cdk.Names.uniqueId(this).toLowerCase()}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
    });

    const lokiAdminBucket = new s3.Bucket(this, 'LokiAdminBucket', {
      bucketName: `unilogs-loki-admin-${this.account}-${
        this.region
      }-${cdk.Names.uniqueId(this).toLowerCase()}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
    });

    // IAM role for Loki pods
    const lokiRole = new iam.Role(this, 'LokiRole', {
      assumedBy: new iam.ServicePrincipal('pods.eks.amazonaws.com'),
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
          enabled: false,
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
          'service.beta.kubernetes.io/aws-load-balancer-healthcheck-healthy-threshold': '2',
          'service.beta.kubernetes.io/aws-load-balancer-healthcheck-unhealthy-threshold': '2',
          'service.beta.kubernetes.io/aws-load-balancer-healthcheck-interval': '10',
        },
      },
      spec: {
        type: 'LoadBalancer',
        ports: [{ port: 80, targetPort: 80, protocol: 'TCP' }],
        selector: { app: 'loki', component: 'gateway' },
      },
    });
    lokiGatewayService.node.addDependency(lokiChart);

    // ==================== GRAFANA UI DEPLOYMENT ====================
    const grafanaChart = cluster.addHelmChart('Grafana', {
      chart: 'grafana',
      repository: 'https://grafana.github.io/helm-charts',
      namespace: 'grafana',
      createNamespace: true,
      values: {
        adminUser: 'admin',
        adminPassword: process.env.GRAFANA_ADMIN_PASSWORD || 'admin',
        persistence: {
          enabled: true,
          storageClassName: 'gp2',
          size: '10Gi',
        },
        datasources: {
          'datasources.yaml': {
            apiVersion: 1,
            datasources: [
              {
                name: 'Loki',
                type: 'loki',
                url: 'http://loki-gateway.loki.svc.cluster.local',
                access: 'proxy',
                isDefault: true,
                jsonData: {
                  maxLines: 1000,
                },
              },
            ],
          },
        },
        service: {
          type: 'LoadBalancer',
          annotations: {
            'service.beta.kubernetes.io/aws-load-balancer-type': 'nlb',
          },
        },
      },
    });
    grafanaChart.node.addDependency(lokiGatewayService);

    // ==================== VECTOR CONSUMER DEPLOYMENT ====================
    const vectorRole = new iam.Role(this, 'VectorRole', {
      assumedBy: new iam.ServicePrincipal('pods.eks.amazonaws.com'),
    });

    cluster.awsAuth.addRoleMapping(vectorRole, {
      username: 'vector',
      groups: ['system:authenticated'],
    });

    vectorRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'kafka-cluster:Connect',
          'kafka-cluster:DescribeGroup',
          'kafka-cluster:DescribeCluster',
          'kafka-cluster:ReadData',
          'kafka-cluster:Read',
          'kafka-cluster:Describe',
          'kafka:DescribeCluster',
          'kafka:GetBootstrapBrokers',
        ],
        resources: [mskCluster.attrArn],
      })
    );

    const vectorChart = cluster.addHelmChart('VectorConsumer', {
      chart: 'vector',
      repository: 'https://helm.vector.dev',
      namespace: 'vector',
      createNamespace: true,
      values: {
        role: 'Agent',
        serviceAccount: {
          create: true,
          annotations: {
            'eks.amazonaws.com/role-arn': vectorRole.roleArn,
          },
        },
        customConfig: {
          sources: {
            kafka: {
              type: 'kafka',
              bootstrap_servers: mskBrokers.getResponseField('BootstrapBrokerStringSaslIam'),
              group_id: 'vector-consumer',
              topics: ['app_logs_topic'],
              security_protocol: 'sasl_ssl',
              sasl: {
                mechanism: 'aws_msk_iam',
                region: this.region
              }
            }
          },
          sinks: {
            loki: {
              type: 'loki',
              inputs: ['kafka'],
              endpoint: 'http://loki-gateway.loki.svc.cluster.local',
              labels: {
                unilogs: 'test_label',
                agent: 'vector'
              },
              encoding: {
                codec: 'json'
              }
            }
          }
        },
        service: {
          enabled: true,
          type: "ClusterIP",
          ports: [
            {
              name: "vector",
              port: 8686,
              targetPort: 8686,
              protocol: "TCP"
            }
          ]
        }
      }
    });

    // MSK Cluster Policy
    new msk.CfnClusterPolicy(this, 'MskClusterPolicy', {
      clusterArn: mskCluster.attrArn,
      policy: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: vectorRole.roleArn },
            Action: 'kafka-cluster:*',
            Resource: mskCluster.attrArn,
          },
        ],
      },
    });

    // ==================== DEPENDENCIES ====================
    lokiChart.node.addDependency(
      lokiChunkBucket,
      lokiRulerBucket,
      lokiAdminBucket,
      mskCluster
    );

    cluster.node.addDependency(mskCluster);
    cluster.node.addDependency(mskSecurityGroup);
    vectorChart.node.addDependency(mskCluster, lokiGatewayService, grafanaChart);

    // ==================== OUTPUTS ====================
    new cdk.CfnOutput(this, 'ClusterName', { value: cluster.clusterName });
    new cdk.CfnOutput(this, 'VpcId', { value: vpc.vpcId });
    new cdk.CfnOutput(this, 'KafkaBootstrapServers', {
      value: mskBrokers.getResponseField('BootstrapBrokerStringSaslIam'),
    });
    new cdk.CfnOutput(this, 'LokiGatewayEndpoint', {
      value: `http://loki-gateway.loki.svc.cluster.local`,
    });
    new cdk.CfnOutput(this, 'LokiGatewayExternalCommand', {
      value: 'kubectl get svc loki-gateway -n loki -o jsonpath="{.status.loadBalancer.ingress[0].hostname}"',
    });
    new cdk.CfnOutput(this, 'GrafanaURLCommand', {
      value: `kubectl get svc -n grafana grafana -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'`,
    });
    new cdk.CfnOutput(this, 'VectorTestCommand', {
      value: 'kubectl logs -n vector -l app.kubernetes.io/instance=vector'
    });
  }
}