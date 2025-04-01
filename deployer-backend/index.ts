import { KubectlV32Layer as KubectlLayer } from "@aws-cdk/lambda-layer-kubectl-v32";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as eks from "aws-cdk-lib/aws-eks";
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from "aws-cdk-lib/aws-iam";
// import * as yaml from 'js-yaml';
// import * as fs from 'fs';

const kubernetesVersion = eks.KubernetesVersion.V1_32;

// including all logging types for now just to see what they look like...
const clusterLogging = [
  eks.ClusterLoggingTypes.API,
  eks.ClusterLoggingTypes.AUTHENTICATOR,
  eks.ClusterLoggingTypes.SCHEDULER,
  eks.ClusterLoggingTypes.AUDIT,
  eks.ClusterLoggingTypes.CONTROLLER_MANAGER,
];

const instanceTypes = [
  new ec2.InstanceType("m5.large"),
  new ec2.InstanceType("m5a.large"),
];

const S3_BUCKET_BASE_ENDPOINT = `s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com`;

class EKSCluster extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "EKSVpc");

    const eksCluster = new eks.Cluster(this, "EKSCluster", {
      vpc: vpc,
      defaultCapacity: 0,
      version: kubernetesVersion,
      kubectlLayer: new KubectlLayer(this, "kubectl"),
      ipFamily: eks.IpFamily.IP_V4,
      clusterLogging: clusterLogging,
    });

    eksCluster.addNodegroupCapacity("custom-node-group", {
      amiType: eks.NodegroupAmiType.AL2023_X86_64_STANDARD,
      instanceTypes: instanceTypes,
      desiredSize: 2,
      minSize: 2,
      maxSize: 5,
      diskSize: 20,
      nodeRole: new iam.Role(this, "eksClusterNodeGroupRole", {
        roleName: "eksClusterNodeGroupRole",
        assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
        managedPolicies: [
          "AmazonEKSWorkerNodePolicy",
          "AmazonEC2ContainerRegistryReadOnly",
          "AmazonEKS_CNI_Policy",
        ].map((policy) => iam.ManagedPolicy.fromAwsManagedPolicyName(policy)),
      }),
    });

    const logBucket = new s3.Bucket(this, 'LogBucket', {
      bucketName: `logBucket-${process.env.AWS_DEFAULT_ACCOUNT}-${process.env.AWS_DEFAULT_REGION}`.toLowerCase(),
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev purposes only
      autoDeleteObjects: true, // For dev purposes only
    });

    const indexBucket = new s3.Bucket(this, 'IndexBucket', {
      bucketName: `indexBucket-${process.env.AWS_DEFAULT_ACCOUNT}-${process.env.AWS_DEFAULT_REGION}`.toLowerCase(),
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev purposes only
      autoDeleteObjects: true, // For dev purposes only
    });

    const lokiHelmChart = eksCluster.addHelmChart('LokiChart', {
      chart: 'loki',
      repository: 'https://grafana.github.io/helm-charts/',
      release: 'loki-release',
      namespace: 'default', // to explicitly match namespace used (by default) by FargateCluster construct
      values: {
        // config values from grafana instructions with details filled in
        // not set up as a YAML file in order to make it easier to reference
        // sensitive data from the environment more simply, without hardcoding.
        loki: {
          // auth_enabled added from untested config example from 2020, rest is 2024
          // auth_enabled: false, // dev only, may bypass auth requirements, simplify?
          schemaConfig: {
            configs: [{
              from: "2024-04-01",
              store: "tsdb",
              object_store: "s3",
              schema: "v13",
              index: {
                prefix: "loki_index_",
                period: "24h"
              }
            }],
          },
          storage_config: {
            aws: {
              region: process.env.AWS_DEFAULT_REGION,
              bucketnames: logBucket.bucketName,
              s3forcepathstyle: false
            }
          },
          pattern_ingester: {
            enabled: true
          },
          limits_config: {
            allow_structured_metadata: true,
            volume_enabled: true,
            retention_period: "672h"
          },
          querier: {
            max_concurrent: 4
          },
          storage: {
            type: "s3",
            bucketNames: {
              chunks: logBucket.bucketName,
              ruler: indexBucket.bucketName
            },
            s3: {
              endpoint: S3_BUCKET_BASE_ENDPOINT,
              region: process.env.AWS_DEFAULT_REGION,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
              accessKeyId: process.env.AWS_ACCESS_KEY,
              signatureVersion: "v4", // standard for most regions
              s3ForcePathStyle: false,
              insecure: false,
              http_config: {}
            }
          }
        },
        deploymentMode: "SimpleScalable",
        backend: {
          replicas: 3
        },
        read: {
          replicas: 3
        },
        write: {
          replicas: 3
        },
        minio: {
          enabled: false
        }
      },
    });

    const grafanaHelmChart = eksCluster.addHelmChart('GrafanaChart', {
      chart: 'grafana',
      repository: 'https://grafana.github.io/helm-charts/',
      release: 'grafana-release',
      namespace: 'default',
      values: {
        rbac: {
          create: true,
      // // Use an existing ClusterRole/Role (depending on rbac.namespaced false/true)
          // useExistingRole: name-of-some-role
          // useExistingClusterRole: name-of-some-clusterRole
          pspEnabled: false,
          pspUseAppArmor: false,
          namespaced: false, // should it be true? does that imply ClusterRole or Role?
          extraRoleRules: [],
          // - apiGroups: []
            // resources: []
            // verbs: []
          extraClusterRoleRules: [],
          // - apiGroups: []
            // resources: []
            // verbs: []
        },
        serviceAccount: {
          create: true,
          // name: 
          // nameTest: 
      // // ServiceAccount labels.
          labels: {},
      // // Service account annotations. Can be templated.
          //  annotations:
            //  eks.amazonaws.com/role-arn: arn:aws:iam::123456789000:role/iam-role-name-here
          automountServiceAccountToken: false
        },
      //  Expose the grafana service to be accessed from outside the cluster (LoadBalancer service).
      //  or access it from within the cluster (ClusterIP service). Set the service type and the port to serve it.
      //  ref: http://kubernetes.io/docs/user-guide/services/
        service: {
          enabled: true,
          type: 'LoadBalancer',
       // // Set the ip family policy to configure dual-stack see [Configure dual-stack](https://kubernetes.io/docs/concepts/services-networking/dual-stack/#services)
          ipFamilyPolicy: 'SingleStack',
       // // Sets the families that should be supported and the order in which they should be applied to ClusterIP as well. Can be IPv4 and/or IPv6.
          ipFamilies: ['IPv4'], // can only use what is configured on cluster
          // loadBalancerSourceRanges: [],
          port: 80,
          targetPort: 3000,
       // //   targetPort: 4181 To be used with a proxy extraContainer
          // Service annotations. Can be templated.
          annotations: {},
          labels: {},
          portName: 'service',
       // // Adds the appProtocol field to the service. This allows to work with istio protocol selection. Ex: "http" or "tcp"
          appProtocol: "",
          sessionAffinity: "",
        },
     // ingress:
        // enabled: false // or true when using nginx? not sure
        //   ingressClassName: nginx
        // annotations: {}
        //     kubernetes.io/ingress.class: nginx
        //     kubernetes.io/tls-acme: "true"
        // labels: {}
        // path: /
        // pathType: Prefix
        // hosts:
        //   - chart-example.local
        persistence: {
          type: 'pvc',
          enabled: true
        }
      },
    });
  }
}

const app = new cdk.App();
new EKSCluster(app, "MyEKSCluster");

app.synth(); // make CloudFormation template for bootstrapping
