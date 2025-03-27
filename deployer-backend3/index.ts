// just noticed discrepancy in version here, changing to v32 instead of v31
// deployment not yet retested!
import { KubectlV32Layer as KubectlLayer } from "@aws-cdk/lambda-layer-kubectl-v32";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as eks from "aws-cdk-lib/aws-eks";

// // adding this back from sample AWS code because of permission issues, may need it
// import * as iam from "aws-cdk-lib/aws-iam";

// new code from ChatGPT for adding S3
import * as s3 from 'aws-cdk-lib/aws-s3';

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

class EKSCluster extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a new VPC for our cluster
    const vpc = new ec2.Vpc(this, "EKSVpc");

    // Create a Fargate-based EKS Cluster.
    // The FargateCluster construct automatically creates a default Fargate
    // profile that targets the "default" namespace.
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

    // // // untested GoogleAI code relying on the cdk8s package
    // // Create Kubernetes Namespace
    // const namespace = new k8s.Namespace(this, 'MyNamespace', {
    //   metadata: {
    //     name: 'my-namespace'
    //   }
    // });

    // // Deploy Helm Chart
    // new k8s.Chart(this, 'MyHelmChart', {
    //   chartName: 'my-chart', // Replace with your chart name
    //   namespace: namespace.metadata.name,
    //   // ... (Helm chart configuration)
    // });


    // // untested ChatGPT code to add S3 bucket and Loki Helm chart
    // Create an S3 bucket for application data
    const appBucket = new s3.Bucket(this, 'AppBucket', {
      // Note: Bucket names must be globally unique; adjust accordingly.
      bucketName: `my-app-bucket-${this.account}-${this.region}`.toLowerCase(),
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev purposes only
      autoDeleteObjects: true, // For dev purposes only
    });

    // add Helm chart(s) for Grafana Loki...
    const lokiHelmChart = eksCluster.addHelmChart('LokiChart', {
      chart: 'loki',
      // chatGPT gave invalid repo for CDK, trying the github link instead
      // recommended loki chart moved to new repo, here:
      repository: 'https://github.com/grafana/loki/tree/main/production/helm/loki',
      release: 'loki-release',
      namespace: 'monitoring',
      values: {
        // Pass any configuration values here, e.g., S3 bucket details for storage
        config: {
          storage_config: {
            aws: {
              s3: {
                bucket: appBucket.bucketName,
                region: process.env.CDK_DEFAULT_REGION || 'us-west-1',
                // additional S3 configuration...
              },
            },
          },
        },
        // shouldn't need to change anything else I think? simple scalable is the default
      },
    });
  }
}

const app = new cdk.App();
new EKSCluster(app, "MyEKSCluster", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-west-1', // added alt default
  },
});



// creates the CloudFormation template based on stack and environment,
// needed for bootstrapping
app.synth();
