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

    // ==================== EKS CLUSTER ====================

    const deployingUser = iam.User.fromUserName(
      this,
      'DeployingUser',
      process.env.AWS_USER_NAME!
    );

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
      nodeRole: new iam.Role(this, 'EKSClusterNodeGroupRole', {
        roleName: 'EKSClusterNodeGroupRole',
        assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
        managedPolicies: [
          'AmazonEKSWorkerNodePolicy',
          'AmazonEC2ContainerRegistryReadOnly',
          'AmazonEKS_CNI_Policy',
        ].map((policy) => iam.ManagedPolicy.fromAwsManagedPolicyName(policy)),
      }),
    });

    // Explicitly map the IAM user
    cluster.awsAuth.addUserMapping(deployingUser, {
      groups: ['system:masters'],
      username: 'deployingUserAdmin',
    });

    // ---------------- EKS Add-ons ----------------------

    // enable metrics, at least for dev
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
            type: 'LoadBalancer',
            port: '3100',
            annotations: {
              'service.beta.kubernetes.io/aws-load-balancer-type': 'nlb',
              'service.beta.kubernetes.io/aws-load-balancer-additional-resource-tags':
                'name=unilogs-loki-lb',
            },
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
            'service.beta.kubernetes.io/aws-load-balancer-additional-resource-tags':
              'name=unilogs-grafana-lb',
          },
        },
        serviceAccount: {
          create: true,
          name: 'grafana-service-account',
          annotations: {
            'eks.amazonaws.com/role-arn': grafanaRole.roleArn,
          },
        },
        autoscaling: { enabled: true }, // 1-5 pods
      },
    });
    // grafanaChart.node.addDependency(lokiGatewayService); wanna remove lokiGatewayService, probably need a new dependancy so grafana does not initialize before loki?
    // not sure if I can add dependancies like this, but it's worth a try as it seems how vector gets a dependancy on grafana
    grafanaChart.node.addDependency(lokiChart);

    // ==================== DEPENDENCIES ====================
    lokiChart.node.addDependency(lokiChunkBucket, lokiRulerBucket);

    // ==================== OUTPUTS ====================
    new cdk.CfnOutput(this, 'ClusterName', { value: cluster.clusterName });
    new cdk.CfnOutput(this, 'VpcId', { value: vpc.vpcId });
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
new UnilogsCdkStack(app, 'UnilogsEksStack');
app.synth();
