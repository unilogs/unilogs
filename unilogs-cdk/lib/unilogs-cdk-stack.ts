import * as cdk from 'aws-cdk-lib';
import { CfnJson } from 'aws-cdk-lib';
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

    // Helper function for IAM conditions
    const createConditionJson = (id: string, serviceAccount: string) => {
      return new CfnJson(this, id, {
        value: {
          [`${cluster.clusterOpenIdConnectIssuerUrl}:aud`]: 'sts.amazonaws.com',
          [`${cluster.clusterOpenIdConnectIssuerUrl}:sub`]: `system:serviceaccount:${serviceAccount}`,
        },
      });
    };

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
      `,
    });

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
          iam: {
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

    const deployingUser = iam.User.fromUserName(this, 'DeployingUser', process.env.AWS_USER_NAME!);

    const cluster = new eks.Cluster(this, 'EksCluster', {
      vpc,
      version: eks.KubernetesVersion.V1_32,
      kubectlLayer: new KubectlLayer(this, 'kubectl'),
      clusterName: 'unilogs-cluster',
      defaultCapacity: 0, // We'll add our own node groups
      authenticationMode: eks.AuthenticationMode.API_AND_CONFIG_MAP,
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
      nodeRole: new iam.Role(this, "EKSClusterNodeGroupRole", {
        roleName: "EKSClusterNodeGroupRole",
        assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
        managedPolicies: [
          "AmazonEKSWorkerNodePolicy",
          "AmazonEC2ContainerRegistryReadOnly",
          "AmazonEKS_CNI_Policy",
        ].map((policy) => iam.ManagedPolicy.fromAwsManagedPolicyName(policy)),
      }),
    });

    // Explicitly map the IAM user
    cluster.awsAuth.addUserMapping(
      deployingUser,
      {
        groups: ['system:masters'],
        username: 'deployingUserAdmin',
      }
    );

    // ---------------- EKS Add-ons ----------------------

    // // prerequisite for add-ons reliant on pod identities, preserved in case we need it
    // new eks.CfnAddon(this, 'PodIdentityAgentAddon', {
    //   addonName: 'eks-pod-identity-agent',
    //   clusterName: cluster.clusterName,
    //   configurationValues: JSON.stringify({
    //     agent: {
    //       additionalArgs: {
    //         '-b': '169.254.170.23' // specify IPv4 address only, disables IPv6 for cluster compatibility
    //       }
    //     }
    //   }),
    // });

    // driver needed to provision PVCs - patching role into its service account
    const ebsCsiServiceAccount = cluster.addServiceAccount('EbsCsiServiceAccount', {
      name: 'ebs-csi-controller-sa',
      namespace: 'kube-system', // default for this add-on, other things may expect it
    });

    ebsCsiServiceAccount.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonEBSCSIDriverPolicy')
    );

    cluster.addHelmChart('EbsCsiDriverHelm', {
      chart: 'aws-ebs-csi-driver',
      repository: 'https://kubernetes-sigs.github.io/aws-ebs-csi-driver/',
      namespace: 'kube-system',
      values: {
        controller: {
          serviceAccount: {
            create: false,
            name: ebsCsiServiceAccount.serviceAccountName,
          },
        }
      },
    });

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
          persistence: { enabled: true, storageClassName: 'gp2', size: '10Gi' },
        },
        read: {
          replicas: 1, // Reduced from 2
          persistence: { enabled: true, storageClassName: 'gp2', size: '10Gi' },
        },
        write: {
          replicas: 1, // Reduced from 3
          persistence: { enabled: true, storageClassName: 'gp2', size: '10Gi' },
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
    grafanaChart.node.addDependency(lokiGatewayService);

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
        customConfig: {
          sources: {
            kafka: {
              type: 'kafka',
              bootstrap_servers: mskBrokers.getResponseField(
                'BootstrapBrokerStringSaslIam'
              ),
              group_id: 'vector-consumer',
              topics: ['app_logs_topic'],
              sasl: {
                mechanism: 'AWS_MSK_IAM',
                oauthbearer_token_provider: 'aws',
                region: this.region,
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

    vectorChart.node.addDependency(vectorNamespace);

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
      mskCluster
    );

    cluster.node.addDependency(mskCluster);
    cluster.node.addDependency(mskSecurityGroup);
    vectorChart.node.addDependency(
      mskCluster,
      lokiGatewayService,
      grafanaChart,
      mskBrokers
    );

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

// explicitly instantiate app, stack, and synth() to ensure updated template
const app = new cdk.App();
new UnilogsCdkStack(app, 'EksStack');
app.synth();
