import * as cdk from 'aws-cdk-lib';
import { CfnJson } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as msk from 'aws-cdk-lib/aws-msk';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
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
    const mskConfig = new msk.CfnConfiguration(this, 'MskConfig', {
      name: 'unilogs-config',
      kafkaVersionsList: ['3.6.0'],
      serverProperties: `
        auto.create.topics.enable=true
        num.partitions=3
        default.replication.factor=2
        allow.everyone.if.no.acl.found=false
      `,
    });

    const mskSecurityGroup = new ec2.SecurityGroup(this, 'MskSecurityGroup', {
      vpc,
      description: 'Security group for MSK cluster',
      allowAllOutbound: true,
    });

    const mskCluster = new msk.CfnCluster(this, 'UniLogsKafka', {
      clusterName: 'unilogs-kafka',
      kafkaVersion: '3.6.0',
      numberOfBrokerNodes: 2,
      brokerNodeGroupInfo: {
        instanceType: 'kafka.t3.small', // Cost optimized (originally m5.large)
        clientSubnets: vpc.selectSubnets({
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }).subnetIds,
        securityGroups: [mskSecurityGroup.securityGroupId],
        storageInfo: {
          ebsStorageInfo: {
            volumeSize: 20, // Reduced from 100GB
          },
        },
      },
      clientAuthentication: {
        sasl: {
          scram: {
            enabled: true,
          },
        },
      },
      encryptionInfo: {
        encryptionInTransit: {
          clientBroker: 'TLS',
          inCluster: true,
        },
      },
      configurationInfo: {
        arn: mskConfig.attrArn,
        revision: 1,
      },
    });

    // Custom resource to get MSK brokers
    const mskBrokersRole = new iam.Role(this, 'MskBrokersRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    mskBrokersRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          'kafka:GetBootstrapBrokers',
          'kafka:DescribeCluster',
          'kafka:UpdateConnectivity',
          'ec2:DescribeSubnets', // Add this permission
          'ec2:DescribeVpcs', // Often needed with DescribeSubnets
        ],
        resources: ['*'], // These are descriptive actions that typically require wildcard
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

    // Create a Secrets Manager secret for SCRAM credentials
    const scramCredentials = new secretsmanager.Secret(
      this,
      'MskScramCredentials',
      {
        secretName: `AmazonMSK_unilogs-user-${this.stackName}`, // Unique name
        description: 'MSK SCRAM credentials',
        generateSecretString: {
          secretStringTemplate: JSON.stringify({ username: 'unilogs-user' }),
          generateStringKey: 'password',
          excludePunctuation: true,
          passwordLength: 16,
        },
      }
    );

    // Associate the SCRAM secret with the cluster
    const scramSecret = new cr.AwsCustomResource(this, 'MskScramSecret', {
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [mskCluster.attrArn, scramCredentials.secretArn],
      }),
      onCreate: {
        service: 'Kafka',
        action: 'batchAssociateScramSecret',
        parameters: {
          ClusterArn: mskCluster.attrArn,
          SecretArnList: [scramCredentials.secretArn],
        },
        physicalResourceId: cr.PhysicalResourceId.of('MskScramSecret'),
      },
      role: mskBrokersRole,
    });

    // ==================== EKS CLUSTER ====================
    const clusterAdminRole = new iam.Role(this, 'ClusterAdminRole', {
      assumedBy: new iam.AccountRootPrincipal(),
      description: 'Role for cluster administration',
    });

    const cluster = new eks.Cluster(this, 'EksCluster', {
      vpc,
      version: eks.KubernetesVersion.V1_32,
      kubectlLayer: new KubectlLayer(this, 'kubectl'),
      clusterName: 'unilogs-cluster',
      defaultCapacity: 0, // We'll add our own node groups
    });

    // Add managed node groups
    cluster.addNodegroupCapacity('AppNodeGroup', {
      instanceTypes: [
        new ec2.InstanceType('t3.medium'), // Smaller instance (originally m5.large)
      ],
      minSize: 1, // Reduced from 2
      maxSize: 2, // Reduced from 5
      desiredSize: 1, // Reduced from 2
      diskSize: 30, // Reduced from 50GB
      amiType: eks.NodegroupAmiType.AL2_X86_64,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      labels: {
        app: 'unilogs',
        'workload-type': 'application',
      },
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

    // Allow EKS nodes to access MSK
    mskSecurityGroup.addIngressRule(
      ec2.Peer.securityGroupId(cluster.clusterSecurityGroupId),
      ec2.Port.tcpRange(9092, 9098),
      'Allow EKS access to MSK'
    );

    // Allow Public Access to MSK
    mskSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(), // Instead of vpc.vpcCidrBlock
      ec2.Port.tcpRange(9092, 9098),
      'Allow public access'
    );

    // Helper function for IAM conditions
    const createConditionJson = (id: string, serviceAccount: string) => {
      return new CfnJson(this, id, {
        value: {
          [`${cluster.clusterOpenIdConnectIssuerUrl}:aud`]: 'sts.amazonaws.com',
          [`${cluster.clusterOpenIdConnectIssuerUrl}:sub`]: `system:serviceaccount:${serviceAccount}`,
        },
      });
    };

    // ==================== LOKI STORAGE ====================
    const lokiChunkBucket = new s3.Bucket(this, 'LokiChunkBucket', {
      bucketName: `unilogs-loki-chunk-${this.account}-${
        this.region
      }-${cdk.Names.uniqueId(this).toLowerCase()}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    const lokiRulerBucket = new s3.Bucket(this, 'LokiRulerBucket', {
      bucketName: `unilogs-loki-ruler-${this.account}-${
        this.region
      }-${cdk.Names.uniqueId(this).toLowerCase()}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    const lokiAdminBucket = new s3.Bucket(this, 'LokiAdminBucket', {
      bucketName: `unilogs-loki-admin-${this.account}-${
        this.region
      }-${cdk.Names.uniqueId(this).toLowerCase()}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });

    // IAM role for Loki pods with proper IRSA configuration
    const lokiCondition = createConditionJson(
      'LokiCondition',
      'loki:loki-service-account'
    );
    const lokiRole = new iam.Role(this, 'LokiRole', {
      assumedBy: new iam.WebIdentityPrincipal(
        cluster.openIdConnectProvider.openIdConnectProviderArn,
        {
          StringEquals: lokiCondition,
        }
      ),
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
              s3: lokiChunkBucket.bucketName,
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
            retention_period: '672h',
          },
        },
        deploymentMode: 'SimpleScalable',
        backend: {
          replicas: 1, // Reduced from 2
          persistence: { enabled: true, storageClassName: 'gp2', size: '1Gi' },
        },
        read: {
          replicas: 1, // Reduced from 2
          // persistence: { enabled: true, storageClassName: 'gp2', size: '1Gi' },
        },
        write: {
          replicas: 1, // Reduced from 3
          persistence: { enabled: true, storageClassName: 'gp2', size: '1Gi' },
        },
        minio: {
          enabled: false,
        },
        gateway: {
          service: {
            type: 'LoadBalancer',
          },
          basicAuth: {
            enabled: true,
            username: 'admin',
            password: 'secret',
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

    // ==================== GRAFANA UI DEPLOYMENT ====================
    const grafanaCondition = createConditionJson(
      'GrafanaCondition',
      'grafana:grafana-service-account'
    );
    const grafanaRole = new iam.Role(this, 'GrafanaRole', {
      assumedBy: new iam.WebIdentityPrincipal(
        cluster.openIdConnectProvider.openIdConnectProviderArn,
        {
          StringEquals: grafanaCondition,
        }
      ),
    });

    const grafanaChart = cluster.addHelmChart('Grafana', {
      chart: 'grafana',
      repository: 'https://grafana.github.io/helm-charts',
      namespace: 'grafana',
      createNamespace: true,
      values: {
        adminUser: 'admin',
        adminPassword: process.env.GRAFANA_ADMIN_PASSWORD || 'admin',
        persistence: { enabled: true, storageClassName: 'gp2', size: '10Gi' },
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
        serviceAccount: {
          create: true,
          name: 'grafana-service-account',
          annotations: {
            'eks.amazonaws.com/role-arn': grafanaRole.roleArn,
          },
        },
      },
    });

    // ==================== VECTOR CONSUMER DEPLOYMENT ====================
    const vectorCondition = createConditionJson(
      'VectorCondition',
      'vector:vector-service-account'
    );
    const vectorRole = new iam.Role(this, 'VectorRole', {
      assumedBy: new iam.WebIdentityPrincipal(
        cluster.openIdConnectProvider.openIdConnectProviderArn,
        {
          StringEquals: vectorCondition,
        }
      ),
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

    // First, create a Kubernetes secret for the MSK credentials
    const vectorMskSecret = cluster.addManifest('VectorMskSecret', {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: 'msk-credentials',
        namespace: 'vector',
      },
      type: 'Opaque',
      data: {
        username: cdk.Fn.base64(
          scramCredentials.secretValueFromJson('username').unsafeUnwrap()
        ),
        password: cdk.Fn.base64(
          scramCredentials.secretValueFromJson('password').unsafeUnwrap()
        ),
      },
    });

    // Then update the Vector Helm chart configuration
    const vectorChart = cluster.addHelmChart('VectorConsumer', {
      chart: 'vector',
      repository: 'https://helm.vector.dev',
      namespace: 'vector',
      createNamespace: true,
      values: {
        role: 'Agent',
        serviceAccount: {
          create: true,
          name: 'vector-service-account',
          annotations: {
            'eks.amazonaws.com/role-arn': vectorRole.roleArn,
          },
        },
        extraVolumes: [
          {
            name: 'msk-credentials',
            secret: {
              secretName: 'msk-credentials',
            },
          },
        ],
        extraVolumeMounts: [
          {
            name: 'msk-credentials',
            mountPath: '/etc/vector/msk-credentials',
            readOnly: true,
          },
        ],
        customConfig: {
          sources: {
            kafka: {
              type: 'kafka',
              bootstrap_servers: mskBrokers.getResponseField(
                'BootstrapBrokerStringSaslScram'
              ),
              security_protocol: 'SASL_SSL',
              group_id: 'vector-consumer',
              topics: ['app_logs_topic'],
              sasl: {
                mechanism: 'SCRAM-SHA-512',
                username: {
                  valueFrom: {
                    secretKeyRef: {
                      name: 'msk-credentials',
                      key: 'username',
                    },
                  },
                },
                password: {
                  valueFrom: {
                    secretKeyRef: {
                      name: 'msk-credentials',
                      key: 'password',
                    },
                  },
                },
              },
              auto_offset_reset: 'earliest',
            },
          },
          sinks: {
            loki: {
              type: 'loki',
              inputs: ['kafka'],
              endpoint: 'http://loki-gateway.loki.svc.cluster.local',
              labels: {
                unilogs: 'test_label',
                agent: 'vector',
              },
              encoding: {
                codec: 'json',
              },
            },
          },
        },
        service: {
          enabled: true,
          type: 'ClusterIP',
          ports: [
            {
              name: 'vector',
              port: 8686,
              targetPort: 8686,
              protocol: 'TCP',
            },
          ],
        },
      },
    });

    const vectorNamespace = cluster.addManifest('VectorNamespace', {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: { name: 'vector' },
    });

    // ==================== DEPENDENCIES ====================
    // Core infrastructure dependencies
    mskCluster.node.addDependency(mskSecurityGroup, mskConfig);
    scramSecret.node.addDependency(scramCredentials, mskCluster);
    mskBrokers.node.addDependency(mskCluster, scramSecret);

    // EKS depends on network resources
    cluster.node.addDependency(vpc);

    // Loki depends on its storage resources
    lokiChart.node.addDependency(
      lokiChunkBucket,
      lokiRulerBucket,
      lokiAdminBucket
    );

    vectorChart.node.addDependency(vectorMskSecret);

    // ==================== OUTPUTS ====================
    new cdk.CfnOutput(this, 'ClusterName', { value: cluster.clusterName });
    new cdk.CfnOutput(this, 'VpcId', { value: vpc.vpcId });
    // new cdk.CfnOutput(this, 'KafkaBootstrapServersScram', {
    //   value: mskBrokers.getResponseField('BootstrapBrokerStringSaslScram'),
    // });
    new cdk.CfnOutput(this, 'ScramSecretArn', {
      value: scramCredentials.secretArn,
    });
    new cdk.CfnOutput(this, 'LokiGatewayEndpoint', {
      value: `http://loki-gateway.loki.svc.cluster.local`,
    });
    new cdk.CfnOutput(this, 'LokiGatewayExternalCommand', {
      value:
        'kubectl get svc loki-gateway -n loki -o jsonpath="{.status.loadBalancer.ingress[0].hostname}"',
    });
    new cdk.CfnOutput(this, 'GrafanaURLCommand', {
      value: `kubectl get svc -n grafana grafana -o jsonpath='{.status.loadBalancer.ingress[0].hostname}'`,
    });
    new cdk.CfnOutput(this, 'VectorTestCommand', {
      value: 'kubectl logs -n vector -l app.kubernetes.io/instance=vector',
    });
  }
}
