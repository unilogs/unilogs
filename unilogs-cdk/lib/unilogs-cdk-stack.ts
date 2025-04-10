import * as cdk from 'aws-cdk-lib';
import { CfnJson,
  aws_ec2 as ec2,
  aws_msk as msk,
  aws_iam as iam,
  aws_eks as eks,
  aws_s3 as s3,
  custom_resources as cr,
} from 'aws-cdk-lib';
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
        instanceType: 'kafka.t3.small', // Cost optimized (originally m5.large), reduced for dev only
        clientSubnets: vpc.selectSubnets({
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }).subnetIds,
        securityGroups: [mskSecurityGroup.securityGroupId],
        storageInfo: {
          ebsStorageInfo: {
            volumeSize: 20, // Reduced from 100GB for dev
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

    // enable all logging types for dev, comment out others beyond AUDIT for production (matching AWS sample code)
    const clusterLogging = [
      eks.ClusterLoggingTypes.API,
      eks.ClusterLoggingTypes.AUTHENTICATOR,
      eks.ClusterLoggingTypes.SCHEDULER,
      eks.ClusterLoggingTypes.AUDIT,
      eks.ClusterLoggingTypes.CONTROLLER_MANAGER,
    ];

    const cluster = new eks.Cluster(this, 'EksCluster', {
      vpc,
      version: eks.KubernetesVersion.V1_32,
      kubectlLayer: new KubectlLayer(this, 'kubectl'),
      clusterName: 'unilogs-cluster',
      defaultCapacity: 0,
      authenticationMode: eks.AuthenticationMode.API_AND_CONFIG_MAP,
      clusterLogging: clusterLogging,
    });

    // Add managed node groups
    cluster.addNodegroupCapacity('AppNodeGroup', {
      instanceTypes: [
        new ec2.InstanceType('t3.large'), // Smaller instance (originally m5.large) for dev
      ],
      minSize: 2,
      maxSize: 5,
      desiredSize: 2,
      diskSize: 30, // reduced from 50 GB for dev
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

    // enable metrics, at least for dev
    new eks.CfnAddon(this, 'addonMetricsServer', {
      addonName: 'metrics-server',
      clusterName: cluster.clusterName,
    });

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
          autoscaling: { enabled: true }, // 2-6 pods
          persistence: { enabled: true, storageClass: 'gp2', size: '1Gi' }, // reduced from 10GB for dev
        },
        read: {
          autoscaling: { enabled: true }, // 2-6 pods
        },
        write: {
          autoscaling: { enabled: true }, // 2-6 pods
          persistence: { enabled: true, storageClass: 'gp2', size: '1Gi' }, // reduced from 10GB for dev
        },
        minio: {
          enabled: false,
        },
        gateway: {
          service: {
            type: 'LoadBalancer' // should probably be ClusterIp
          },
          basicAuth: {
            enabled: true,
            username: 'admin',
            password: 'secret'
          }
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
        persistence: { enabled: true, storageClassName: 'gp2', size: '1Gi' }, // reduced from 10Gi
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
                  httpHeaderName1: 'X-Scope-OrgId',
                  httpHeaderName2: 'Authorization'
                },
                secureJsonData: {
                  httpHeaderValue1: 'default',
                  httpHeaderValue2: 'Basic YWRtaW46c2VjcmV0' // `echo -n "admin:secret" | base64`
                }
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
          annotations: {
            'eks.amazonaws.com/role-arn': grafanaRole.roleArn,
          },
        },
        autoscaling: { enabled: true }, // 1-5 pods
      },
    });
    grafanaChart.node.addDependency(lokiChart);

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
        role: "Agent",
        serviceAccount: {
          create: true,
          name: "vector-service-account",
          annotations: {
            "eks.amazonaws.com/role-arn": vectorRole.roleArn 
          }
        },
        customConfig: {
          sources: {
            test_logs: {
              type: "demo_logs",
              format: "shuffle", // changed from `json` because `json` was not using `lines`, and it was instead generating random json logs
              lines: [
                '{"timestamp": "2025-04-07T18:46:06.131Z", "level": "INFO", "message": "Test message 1", "unilogs_service_label":"123"}',
                '{"timestamp": "2025-04-07T18:46:06.131Z", "level": "ERROR", "message": "Test message 2", "unilogs_service_label":"abc"}',
                '{"timestamp": "2025-04-07T18:46:06.131Z", "level": "DEBUG", "message": "Test message 3", "unilogs_service_label":"xyz"}'
            ],
              interval: 1
            }
          },
          transforms: {
            parsed_logs: {
              type: "remap",
              inputs: ["test_logs"],
              source: `
                .message_parsed = parse_json!(.message)
                .timestamp = parse_timestamp!(.message_parsed.timestamp, format: "%Y-%m-%dT%H:%M:%S.%fZ")
                .message = .message_parsed.message
                .level = .message_parsed.level
                .inferred_label = .message_parsed.unilogs_service_label
              `.trim()
            }
          },
          sinks: {
            loki: {
              type: "loki",
              inputs: ["parsed_logs"],
              endpoint: "http://loki-gateway.loki.svc.cluster.local/",
              path: "/loki/api/v1/push",
              labels: {
                unilogs_test_label: '{{`{{ inferred_label }}`}}',
                agent: "vector"
              },
              tenant_id: "default",
              encoding: {
                codec: "json"
              },
              auth: {
                strategy: "basic",
                password: "secret",
                user: "admin"
              }
            },
            console: {
              type:'console',
              inputs: ["test_logs", "parsed_logs"],
              encoding: {
                codec:'json'
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
      lokiChart,
      // lokiGatewayService,
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
