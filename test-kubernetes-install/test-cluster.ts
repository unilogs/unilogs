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

class TESTCluster extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "TESTVpc");

    const eksCluster = new eks.Cluster(this, "TESTCluster", {
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
      nodeRole: new iam.Role(this, "TESTClusterNodeGroupRole", {
        roleName: "TESTClusterNodeGroupRole",
        assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
        managedPolicies: [
          "AmazonEKSWorkerNodePolicy",
          "AmazonEC2ContainerRegistryReadOnly",
          "AmazonEKS_CNI_Policy",
        ].map((policy) => iam.ManagedPolicy.fromAwsManagedPolicyName(policy)),
      }),
    });


    const TESTlogBucket = new s3.Bucket(this, 'TESTLogBucket', {
      bucketName: `TESTlogBucket-${process.env.AWS_DEFAULT_ACCOUNT}-${process.env.AWS_DEFAULT_REGION}`.toLowerCase(),
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev purposes only
      autoDeleteObjects: true, // For dev purposes only
    });

    const TESTindexBucket = new s3.Bucket(this, 'TESTIndexBucket', {
      bucketName: `TESTindexBucket-${process.env.AWS_DEFAULT_ACCOUNT}-${process.env.AWS_DEFAULT_REGION}`.toLowerCase(),
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For dev purposes only
      autoDeleteObjects: true, // For dev purposes only
    });
  }
}

const app = new cdk.App();
new TESTCluster(app, "TESTCluster");

app.synth(); // make CloudFormation template for bootstrapping
