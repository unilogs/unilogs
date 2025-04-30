import * as cdk from 'aws-cdk-lib';
import {
  CfnJson,
  aws_ec2 as ec2,
  aws_iam as iam,
  aws_eks as eks,
  aws_s3 as s3,
} from 'aws-cdk-lib';
import { KubectlV32Layer as KubectlLayer } from '@aws-cdk/lambda-layer-kubectl-v32';

export class UnilogsCdkStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Helper function for IAM conditions
    const createConditionJson = (id: string, serviceAccount: string) => {
      const issuerUrl = cluster.openIdConnectProvider.openIdConnectProviderIssuer;
      if (!issuerUrl) {
        throw new Error('Cluster OIDC issuer URL is not available');
      }

      return new CfnJson(this, id, {
        value: {
          [`${issuerUrl}:aud`]: 'sts.amazonaws.com',
          [`${issuerUrl}:sub`]: `system:serviceaccount:${serviceAccount}`,
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

    // ==================== KAFKA SECURITY GROUP ====================
    // Create security group before Kafka deployment
    const kafkaSecurityGroup = new ec2.SecurityGroup(
      this,
      'KafkaSecurityGroup',
      {
        vpc,
        description: 'Kafka security group',
        allowAllOutbound: true,
      }
    );

    // Allow internal traffic
    kafkaSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.allTcp(),
      'Allow internal VPC traffic'
    );

    // Allow all traffic (for testing purposes only)
    kafkaSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.allTcp(),
      'Allow all traffic'
    );

    // ==================== CONTEXT & ENVIRONMENT VARIABLES ====================
    const awsUserName =
      (this.node.tryGetContext('awsUserName') as string) || // For Testing Purposes
      process.env.AWS_USER_NAME;
    if (!awsUserName) {
      throw new Error(
        'AWS Username must be provided via environment variable (AWS_USER_NAME)'
      );
    }

    const grafanaAdminUsername =
      (this.node.tryGetContext('grafanaAdminUsername') as string) || // For Testing Purposes
      process.env.GRAFANA_ADMIN_USERNAME;
    if (!grafanaAdminUsername) {
      throw new Error(
        'Grafana Admin Username must be provided via environment variable (GRAFANA_ADMIN_USERNAME)'
      );
    }

    const grafanaAdminPassword =
      (this.node.tryGetContext('grafanaAdminPassword') as string) || // For Testing Purposes
      process.env.GRAFANA_ADMIN_PASSWORD;
    if (!grafanaAdminPassword) {
      throw new Error(
        'Grafana Admin Password must be provided via environment variable (GRAFANA_ADMIN_PASSWORD)'
      );
    }

    const kafkaSaslUsername =
      (this.node.tryGetContext('kafkaSaslUsername') as string) || // For Testing Purposes
      process.env.KAFKA_SASL_USERNAME;
    if (!kafkaSaslUsername) {
      throw new Error(
        'Kafka SASL username must be provided via environment variable (KAFKA_SASL_USERNAME)'
      );
    }

    const kafkaSaslPassword =
      (this.node.tryGetContext('kafkaSaslPassword') as string) || // For Testing Purposes
      process.env.KAFKA_SASL_PASSWORD;
    if (!kafkaSaslPassword) {
      throw new Error(
        'Kafka SASL password must be provided via environment variable (KAFKA_SASL_PASSWORD)'
      );
    }

    // ==================== EKS CLUSTER ====================
    const deployingUser = iam.User.fromUserName(
      this,
      'DeployingUser',
      awsUserName
    );

    // For AWS Cloudwatch Monitoring
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

    const nodeGroupRole = new iam.Role(this, 'EKSClusterNodeGroupRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKSWorkerNodePolicy'),
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'AmazonEC2ContainerRegistryReadOnly'
        ),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonEKS_CNI_Policy'),
      ],
    });

    // Add managed node groups
    cluster.addNodegroupCapacity('AppNodeGroup', {
      instanceTypes: [
        new ec2.InstanceType('t3.large'), // m5.large
      ],
      minSize: 2,
      maxSize: 50, // Maybe reduce to 10?
      desiredSize: 2, 
      diskSize: 30, // 50GB
      amiType: eks.NodegroupAmiType.AL2_X86_64,
      subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      labels: {
        app: 'unilogs',
        'workload-type': 'application',
      },
      nodeRole: nodeGroupRole,
    });

    // Explicitly map the IAM user
    cluster.awsAuth.addUserMapping(deployingUser, {
      groups: ['system:masters'],
      username: 'deployingUserAdmin',
    });

    // ==================== EKS ADD ONS ====================

    // Metrics for Cloudwatch
    new eks.CfnAddon(this, 'addonMetricsServer', {
      addonName: 'metrics-server',
      clusterName: cluster.clusterName,
    });

    // driver needed to provision PVCs - patching role into its service account
    const ebsCsiServiceAccount = cluster.addServiceAccount(
      'EbsCsiServiceAccount',
      {
        name: 'ebs-csi-controller-sa',
        namespace: 'kube-system', // default for this add-on, other things may expect it
      }
    );

    ebsCsiServiceAccount.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AmazonEBSCSIDriverPolicy'
      )
    );

    const ebsCsiDriver = cluster.addHelmChart('EbsCsiDriverHelm', {
      chart: 'aws-ebs-csi-driver',
      repository: 'https://kubernetes-sigs.github.io/aws-ebs-csi-driver/',
      namespace: 'kube-system',
      values: {
        controller: {
          serviceAccount: {
            create: false,
            name: ebsCsiServiceAccount.serviceAccountName,
          },
        },
      },
    });

    // ==================== KAFKA ON EKS ====================
    const kafkaChart = cluster.addHelmChart('kafka', {
      release: 'kafka',
      version: '32.1.3',
      chart: 'kafka',
      repository: 'https://charts.bitnami.com/bitnami',
      namespace: 'kafka',
      createNamespace: true,
      values: {
        // Cluster configuration
        replicaCount: 3,
        clusterId: 'unilogs-kafka-cluster',

        controller: {
          automountServiceAccountToken: true,
          persistence: {
            storageClass: 'gp2',
            size: '10Gi',
            accessModes: ['ReadWriteOnce'],
          },
          readinessProbe: {
            initialDelaySeconds: 60,
            periodSeconds: 15,
            timeoutSeconds: 10,
          },
        },

        broker: {
          automountServiceAccountToken: true,
          persistence: {
            storageClass: 'gp2',
            size: '10Gi',
            accessModes: ['ReadWriteOnce'],
          },
        },

        // Simplified listener configuration - PLAINTEXT only
        listeners: {
          client: {
            protocol: 'PLAINTEXT',
            containerPort: 9092,
          },
          controller: {
            protocol: 'PLAINTEXT',
            containerPort: 9093,
          },
          interbroker: {
            protocol: 'PLAINTEXT',
            containerPort: 9094,
          },
          external: {
            protocol: 'SASL_SSL',
            containerPort: 9095,
          },
        },

        sasl: {
          enabledMechanisms: 'PLAIN',
          client: {
            users: [kafkaSaslUsername],
            passwords: [kafkaSaslPassword],
          },
        },

        tls: {
          autoGenerated: {
            enabled: true,
          },
          type: 'PEM',
        },

        defaultInitContainers: {
          autoDiscovery: {
            enabled: true,
          },
        },
        serviceAccount: {
          create: true,
        },
        rbac: {
          create: true,
        },

        externalAccess: {
          enabled: true,
          controller: {
            service: {
              type: 'LoadBalancer',
              ports: {
                external: 9095,
              },
              annotations: {
                'service.beta.kubernetes.io/aws-load-balancer-type': 'nlb',
                'service.beta.kubernetes.io/aws-load-balancer-scheme':
                  'internet-facing',
                'service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled':
                  'true',
              },
            },
          },
        },

        persistence: {
          enabled: true,
          size: '10Gi',
          storageClass: 'gp2',
          accessModes: ['ReadWriteOnce'],
        },

        resources: {
          requests: {
            memory: '2Gi',
            cpu: '1',
          },
          limits: {
            memory: '4Gi',
            cpu: '2',
          },
        },
        provisioning: {
          enabled: true,
          automountServiceAccountToken: true,
          numPartitions: 3,
          replicationFactor: 3,
          topics: [{ name: 'app_logs_topic' }],
          serviceAccount: {
            automountServiceAccountToken: true,
          },
        },
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
      assumedBy: new iam.FederatedPrincipal(
        cluster.openIdConnectProvider.openIdConnectProviderArn,
        {StringEquals: lokiCondition},
        'sts:AssumeRoleWithWebIdentity'
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
          storage: {
            type: 's3',
            bucketNames: {
              chunks: lokiChunkBucket.bucketName,
              ruler: lokiRulerBucket.bucketName,
            },
            s3: {
              region: this.region,
              s3ForcePathStyle: false,
              insecure: false,
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
          autoscaling: { enabled: true },
          persistence: { enabled: true, storageClass: 'gp2', size: '1Gi' }, // reduced from 10GB for dev
        },
        read: {
          autoscaling: { enabled: true },
        },
        write: {
          autoscaling: { enabled: true },
          persistence: { enabled: true, storageClass: 'gp2', size: '1Gi' }, // reduced from 10GB for dev
        },
        minio: {
          enabled: false,
        },
        gateway: {
          service: {
            type: 'ClusterIP',
          },
          
          // Only used internally to connect Loki with Vector
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
        adminUser: grafanaAdminUsername,
        adminPassword: grafanaAdminPassword,
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
                  httpHeaderName1: 'X-Scope-OrgId',
                  httpHeaderName2: 'Authorization',
                },
                secureJsonData: {
                  httpHeaderValue1: 'default',
                  httpHeaderValue2: 'Basic YWRtaW46c2VjcmV0', // This string is "admin:secret" base64 encoded in order to connect Grafana with Loki
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
        autoscaling: { enabled: true },
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

    const vectorChart = cluster.addHelmChart('VectorConsumer', {
      chart: 'vector',
      repository: 'https://helm.vector.dev',
      namespace: 'vector',
      createNamespace: true,
      values: {
        role: 'Aggregator',
        autoscaling: { enabled: true },
        resources: {
          requests: {
            cpu: '200m',
            memory: '256Mi'
          },
          limits: {
            cpu: '200m',
            memory: '256Mi'
          },
        },
        service: {
          enabled: true,
          ports: [
            {
              name: 'http',
              port: 8686,
              targetPort: 8686,
            },
          ],
        },
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
              bootstrap_servers: 'kafka.kafka.svc.cluster.local:9092',
              topics: ['app_logs_topic'],
              group_id: 'vector-consumer',
            },
          },
          transforms: {
            parsed_logs: {
              type: 'remap',
              inputs: ['kafka'],
              source: `
                parsed = parse_json!(.message)
                parsed = remove!(parsed, ["timestamp"])
                del(.message)
                . = merge!(., parsed)
              `.trim(),
            },
          },
          sinks: {
            loki: {
              type: 'loki',
              inputs: ['parsed_logs'],
              endpoint: 'http://loki-gateway.loki.svc.cluster.local/',
              path: '/loki/api/v1/push',
              labels: {
                service_name: '{{`{{ unilogs_service_label }}`}}',
                agent: 'vector',
              },
              tenant_id: 'default',
              encoding: {
                codec: 'json',
              },
              auth: {
                strategy: 'basic',
                password: 'secret',
                user: 'admin',
              },
            },
            // For Debugging Purposes to see logs within Vector Pods
            console: {
              type:'console',
              inputs: ['parsed_logs'],
              encoding: {
                codec:'json'
              }
            }
          },
        },
      },
    });

    // ==================== DEPENDENCIES ====================
    grafanaChart.node.addDependency(lokiChart);
    lokiChart.node.addDependency(
      lokiChunkBucket,
      lokiRulerBucket,
      ebsCsiDriver
    );
    vectorChart.node.addDependency(lokiChart, kafkaChart, ebsCsiDriver);
    kafkaChart.node.addDependency(kafkaSecurityGroup, ebsCsiDriver);
    cluster.node.addDependency(vpc, nodeGroupRole);
    ebsCsiDriver.node.addDependency(ebsCsiServiceAccount);
  }
}
