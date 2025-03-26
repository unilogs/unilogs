import * as dotenv from 'dotenv';
dotenv.config();

import { KubectlV31Layer as KubectlLayer } from "@aws-cdk/lambda-layer-kubectl-v31";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as eks from "aws-cdk-lib/aws-eks";

// not the latest version I think, should update
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

    // Managed Addons: install common EKS add-ons (kube-proxy, CoreDNS, etc.)
    const addManagedAddon = (id: string, addonName: string) => {
      new eks.CfnAddon(this, id, {
        addonName,
        clusterName: eksCluster.clusterName,
      });
    };

    // not sure how many of these are needed, but keeping them all for now
    // should review to understand function and remove unnecessary ones

    // AWS EKS console said these 3 were versions incompatible with the next
    // Kubernetes version, V1_32. should test if the add-on version is updated
    // when added if added to a stack initialized with V1_32
    addManagedAddon("addonKubeProxy", "kube-proxy");
    addManagedAddon("addonCoreDns", "coredns");
    addManagedAddon("addonVpcCni", "vpc-cni");

    // these 2 were fine
    addManagedAddon("addonEksPodIdentityAgent", "eks-pod-identity-agent");
    addManagedAddon("addonMetricsServer", "metrics-server"); // critical for HPA
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
