// just noticed discrepancy in version here, changing to v32 instead of v31
// deployment not yet retested!
import { KubectlV32Layer as KubectlLayer } from "@aws-cdk/lambda-layer-kubectl-v32";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as eks from "aws-cdk-lib/aws-eks";
import * as s3 from 'aws-cdk-lib/aws-s3';

// // adding this back from sample AWS code because of permission issues, may need it
// import * as iam from "aws-cdk-lib/aws-iam";

// the latest version as of March 2025
const kubernetesVersion = eks.KubernetesVersion.V1_32;

// including all logging types for now just to see what they look like...
const clusterLogging = [
  eks.ClusterLoggingTypes.API,
  eks.ClusterLoggingTypes.AUTHENTICATOR,
  eks.ClusterLoggingTypes.SCHEDULER,
  eks.ClusterLoggingTypes.AUDIT,
  eks.ClusterLoggingTypes.CONTROLLER_MANAGER,
];

const S3_BUCKET_BASE_ENDPOINT = `s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com`;

class EKSCluster extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "EKSVpc");

    const eksCluster = new eks.FargateCluster(this, "FargateCluster", {
      vpc,
      version: kubernetesVersion,
      kubectlLayer: new KubectlLayer(this, "kubectl"),
      clusterLogging: clusterLogging,
    });

    // // seems like these add-ons are incorporated into the cluster by default for V1_32
    // // they are not visible in the "add-ons" section of the cluster, unlike with V1_31
    // // I have not yet tested deployment without this code, however

    // const addManagedAddon = (id: string, addonName: string) => {
    //   new eks.CfnAddon(this, id, {
    //     addonName,
    //     clusterName: eksCluster.clusterName,
    //   });
    // };

    // addManagedAddon("addonKubeProxy", "kube-proxy");
    // addManagedAddon("addonCoreDns", "coredns");
    // addManagedAddon("addonVpcCni", "vpc-cni");
    // addManagedAddon("addonEksPodIdentityAgent", "eks-pod-identity-agent");
    // addManagedAddon("addonMetricsServer", "metrics-server"); // critical for HPA

    const logBucket = new s3.Bucket(this, 'LogBucket', { // names must be globally unique across AWS
      bucketName: `logBucket-${process.env.AWS_DEFAULT_ACCOUNT}-${process.env.AWS_DEFAULT_REGION}`.toLowerCase(),
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev purposes only
      autoDeleteObjects: true, // For dev purposes only
    });

    const indexBucket = new s3.Bucket(this, 'IndexBucket', {
      bucketName: `indexBucket-${process.env.AWS_DEFAULT_ACCOUNT}-${process.env.AWS_DEFAULT_REGION}`.toLowerCase(),
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev purposes only
      autoDeleteObjects: true, // For dev purposes only
    });

    // add Helm chart for Grafana Loki -- should only be one chart, I think, the "loki" chart
    const lokiHelmChart = eksCluster.addHelmChart('LokiChart', {
      chart: 'loki',
      repository: 'https://grafana.github.io/helm-charts/',
      release: 'loki-release',
      namespace: 'default', // to explicitly match namespace used (by default) by FargateCluster construct
      values: {
        // config values from grafana instructions with details filled in
        // (refactor todo: extract to yaml config file and load in)
        // values may be for both the "loki" chart and the "grafana/loki" chart
        loki: {
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
              // admin: "your-admin-bucket" // not used unless enterprise mode
            },
            s3: {
              // // not using the s3 url because we don't need to, and also I'm not sure which bucket name to specify
              // s3: `s3://${process.env.AWS_ACCESS_KEY}:${process.env.AWS_SECRET_ACCESS_KEY}@${S3_BUCKET_BASE_ENDPOINT}/bucket_name`,
              // // using individual fields instead:
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
  }
}

const app = new cdk.App();
new EKSCluster(app, "MyEKSCluster", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1', // added alt default which seems to match AWS default region
  },
});

// creates the CloudFormation template based on stack and environment,
// needed for bootstrapping
app.synth();
