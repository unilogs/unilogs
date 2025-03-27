import * as dotenv from 'dotenv';
dotenv.config();

import { KubectlV31Layer as KubectlLayer } from "@aws-cdk/lambda-layer-kubectl-v31";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as eks from "aws-cdk-lib/aws-eks";

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
