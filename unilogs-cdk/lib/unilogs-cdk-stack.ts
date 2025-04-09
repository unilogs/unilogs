import * as cdk from 'aws-cdk-lib';
import { CfnJson } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { KubectlV32Layer as KubectlLayer } from '@aws-cdk/lambda-layer-kubectl-v32';

export class UnilogsCdkStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Helper function for IAM conditions
    const createConditionJson = (id: string, serviceAccount: string) => {
      const issuerUrl = cluster.clusterOpenIdConnectIssuerUrl;
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

    // Allow external SASL access
    kafkaSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcpRange(9094, 9095), // Cover both controller and broker external ports
      'Allow external SASL access'
    );

    // ==================== EKS CLUSTER ====================

    const deployingUser = iam.User.fromUserName(
      this,
      'DeployingUser',
      process.env.AWS_USER_NAME!
    );

    // enable all logging types, though maybe just leave AUDIT for production
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
      defaultCapacity: 0, // We'll add our own node groups
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
        new ec2.InstanceType('t3.large'), // Smaller instance (originally m5.large)
      ],
      minSize: 2, // Reduced from 2
      maxSize: 5, // Reduced from 5
      desiredSize: 2, // Reduced from 2
      diskSize: 30, // Reduced from 50GB
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

    // enable metrics, at least for dev
    new eks.CfnAddon(this, 'addonMetricsServer', {
      addonName: 'metrics-server',
      clusterName: cluster.clusterName,
    });

    // // driver needed to provision PVCs - patching role into its service account
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
    const kafkaNamespace = cluster.addManifest('KafkaNamespace', {
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: { name: 'kafka' }, // Explicitly create namespace
    });

    // Create secret for SCRAM credentials
    const scramSecret = cluster.addManifest('KafkaScramSecret', {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: 'kafka-scram-credentials',
        namespace: 'kafka',
      },
      type: 'Opaque',
      data: {
        // CORRECTED KEY NAMES (remove 'sasl-' prefix)
        'client-passwords': Buffer.from('password').toString('base64'),
        'inter-broker-password':
          Buffer.from('broker-password').toString('base64'),
        'controller-password': Buffer.from('controller-password').toString(
          'base64'
        ),
      },
    });

    const kafkaChart = cluster.addHelmChart('kafka', {
      release: 'kafka',
      version: '32.1.3',
      chart: 'kafka',
      repository: 'https://charts.bitnami.com/bitnami',
      namespace: 'kafka',
      values: {
        volumePermissions: {
          enabled: true,
          image: {
            registry: 'docker.io',
            repository: 'bitnami/os-shell',
            tag: '11-debian-11-r86',
            pullPolicy: 'IfNotPresent',
          },
          resources: {
            limits: {
              cpu: '100m',
              memory: '128Mi',
            },
            requests: {
              cpu: '100m',
              memory: '128Mi',
            },
          },
        },

        // Cluster configuration
        replicaCount: 3, // Minimum 3 nodes for KRaft
        clusterId: 'unilogs-kafka-cluster',

        controller: {
          automountServiceAccountToken: true,
          persistence: {
            storageClass: 'gp2',
            size: '10Gi', // Can be different from controllers
            accessModes: ['ReadWriteOnce'],
          },
          sasl: {
            enabled: true,
            existingSecret: 'kafka-scram-credentials',
            passwordKey: 'controller-password'
          },
          quorumVoters:
            'unilogs-kafka-cluster@kafka-0.kafka-headless.kafka.svc.cluster.local:9093,kafka-1.kafka-headless.kafka.svc.cluster.local:9093,kafka-2.kafka-headless.kafka.svc.cluster.local:9093',
        },

        broker: {
          automountServiceAccountToken: true,
          persistence: {
            storageClass: 'gp2',
            size: '10Gi', // Can be different from controllers
            accessModes: ['ReadWriteOnce'],
          },
        },

        // Listener configuration
        listenerSecurityProtocolMap:
          'CONTROLLER:SASL_SSL,INTERNAL:SASL_SSL,EXTERNAL:SASL_SSL,CLIENT:SASL_SSL',
        listeners: {
          external: {
            protocol: 'SASL_SSL',
            containerPort: 9095,
          },
          client: {
            protocol: 'SASL_SSL',
            containerPort: 9092,
          },
          controller: {
            protocol: 'SASL_SSL',
            containerPort: 9093,
          },
          interbroker: {
            protocol: 'SASL_SSL',
            containerPort: 9094,
          },
        },

        // Security configuration
        sasl: {
          existingSecret: 'kafka-scram-credentials',
          enabledMechanisms: 'SCRAM-SHA-512',
          interBrokerMechanism: 'SCRAM-SHA-512',
          controllerMechanism: 'SCRAM-SHA-512',
          client: {
            users: ['vector-client'],
          },
          interBrokerUser: 'inter_broker_user',       // Add this
          controllerUser: 'controller_user',          // Add this
        },

        tls: {
          type: 'PEM',
          authType: 'required', // Enforce mTLS
          autoGenerated: {
            enabled: true, // Enable auto-generated certificates
          },
          existingSecret: '', // Clear this if it was set
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

        // External access
        externalAccess: {
          enabled: true,
          autoDiscovery: {
            enabled: true, // Required for dynamic discovery of external IPs
          },
          broker: {
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
          controller: {
            service: {
              type: 'LoadBalancer',
              ports: {
                external: 9094,
              },
              annotations: {
                'service.beta.kubernetes.io/aws-load-balancer-type': 'nlb',
              },
            },
          },
        },

        // Persistence
        persistence: {
          enabled: true,
          size: '10Gi',
          storageClass: 'gp2',
          accessModes: ['ReadWriteOnce'],
        },

        // Resource limits
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

          persistence: { enabled: true, storageClass: 'gp2', size: '1Gi' },
        },
        read: {
          replicas: 1, // Reduced from 2
          // read shouldn't need persistence
          // persistence: { enabled: true, storageClass: 'gp2', size: '1Gi' },
        },
        write: {
          replicas: 1, // Reduced from 3
          persistence: { enabled: true, storageClass: 'gp2', size: '1Gi' },
        },
        minio: {
          enabled: false,
        },
        gateway: {
          service: {
            type: 'LoadBalancer',
            port: 3100, // Explicitly set port
            targetPort: 3100,
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
                  httpHeaderName1: 'X-Scope-OrgId',
                  httpHeaderName2: 'Authorization',
                },
                secureJsonData: {
                  httpHeaderValue1: 'default',
                  httpHeaderValue2: 'Basic YWRtaW46c2VjcmV0', // `echo -n "admin:secret" | base64`
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

    const vectorChart = cluster.addHelmChart('VectorConsumer', {
      chart: 'vector',
      repository: 'https://helm.vector.dev',
      namespace: 'vector',
      createNamespace: true,
      values: {
        role: 'Agent',
        service: {
          // Add this section
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
              sasl: {
                username: 'vector-client',
                password: 'password',
                mechanism: 'scram-sha-512',
              },
            },
          },
          sinks: {
            loki: {
              type: 'loki',
              inputs: ['kafka'],
              endpoint: 'http://loki-gateway.loki.svc.cluster.local:3100',
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
    kafkaChart.node.addDependency(
      kafkaSecurityGroup,
      scramSecret,
      kafkaNamespace,
      ebsCsiDriver
    );
    scramSecret.node.addDependency(kafkaNamespace);
    cluster.node.addDependency(vpc, nodeGroupRole);
    ebsCsiDriver.node.addDependency(ebsCsiServiceAccount);

    // ==================== OUTPUTS ====================
    new cdk.CfnOutput(this, 'ClusterName', { value: cluster.clusterName });
    new cdk.CfnOutput(this, 'VpcId', { value: vpc.vpcId });
    new cdk.CfnOutput(this, 'KafkaTestCommand', {
      value:
        'kubectl exec -n kafka kafka-0 -- kafka-topics.sh --list --bootstrap-server localhost:9092',
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
