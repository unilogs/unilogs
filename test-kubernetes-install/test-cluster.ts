import { KubectlV32Layer as KubectlLayer } from "@aws-cdk/lambda-layer-kubectl-v32";
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as eks from "aws-cdk-lib/aws-eks";
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from "aws-cdk-lib/aws-iam";
// import * as yaml from 'js-yaml';
// import * as fs from 'fs';

const kubernetesVersion = eks.KubernetesVersion.V1_32;

const S3_BUCKET_BASE_ENDPOINT = `s3.${process.env.AWS_DEFAULT_REGION}.amazonaws.com`;

// including all logging types for now just to see what they look like...
const clusterLogging = [
  eks.ClusterLoggingTypes.API,
  eks.ClusterLoggingTypes.AUTHENTICATOR,
  eks.ClusterLoggingTypes.SCHEDULER,
  eks.ClusterLoggingTypes.AUDIT,
  eks.ClusterLoggingTypes.CONTROLLER_MANAGER,
];

class TESTCluster extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, "TESTVpc");

    const TESTClusterRole = new iam.Role(this, 'TESTClusterRole', {
      assumedBy: new iam.ServicePrincipal('eks.amazonaws.com'),
      managedPolicies: [
        // these 5 policies needed to allow enabling Auto Mode later
        'AmazonEKSComputePolicy',
        'AmazonEKSBlockStoragePolicy',
        'AmazonEKSLoadBalancingPolicy',
        'AmazonEKSNetworkingPolicy',
        'AmazonEKSClusterPolicy'
      ].map((policy) => iam.ManagedPolicy.fromAwsManagedPolicyName(policy)),
    });

    // Create a policy that grants sts:AssumeRole and sts:TagSession and attach it as an inline policy.
    TESTClusterRole.assumeRolePolicy?.addStatements(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ["sts:TagSession"],
      principals: [new iam.ServicePrincipal('eks.amazonaws.com')],
    }));

    const TESTCluster = new eks.Cluster(this, "TESTCluster", {
      vpc: vpc,
      // defaultCapacity: 0,
      version: kubernetesVersion,
      kubectlLayer: new KubectlLayer(this, "kubectl"),
      // ipFamily: eks.IpFamily.IP_V4,
      clusterLogging: clusterLogging,
      authenticationMode: eks.AuthenticationMode.API_AND_CONFIG_MAP,
      role: TESTClusterRole,
    });

    const deployingUser = iam.User.fromUserName(this, 'DeployingUser', `${process.env.USER_NAME}`);

    TESTCluster.awsAuth.addUserMapping(deployingUser, {
      username: `${process.env.USER_NAME}`,
      groups: ['system:masters'],
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
