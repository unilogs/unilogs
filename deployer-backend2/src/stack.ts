import { Stack, StackProps, aws_eks as eks } from 'aws-cdk-lib';
import { KubectlV32Layer } from '@aws-cdk/lambda-layer-kubectl-v32';
import { Construct } from 'constructs';

export class UnilogsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create S3 Bucket
    // const appBucket = new s3.Bucket(this, 'AppBucket', {
    //   // Note: Bucket names must be globally unique; adjust accordingly.
    //   bucketName: `write-${Date.now()}`.toLowerCase(),
    //   removalPolicy: RemovalPolicy.DESTROY, // For dev purposes only
    //   autoDeleteObjects: true, // For dev purposes only
    // });
    
    // Create EKS Cluster
    const cluster = new eks.FargateCluster(this, 'UnilogsCluster', {
      clusterName: 'unilogs-cluster',
      version: eks.KubernetesVersion.V1_32,
      kubectlLayer: new KubectlV32Layer(this, 'kubectl'),
    });

    // Create namespace for application
    // const namespace = cluster.addManifest('AppNamespace', {
    //   apiVersion: 'v2',
    //   kind: 'Namespace',
    //   metadata: {name: 'unilogs-namespace'}
    // });

    // Add Fargate profile to Cluster
    // cluster.addFargateProfile('UnilogsFargateProfile', {
    //   selectors: [{ namespace: 'unilogs-namespace' }],
    // });

    // Add Helm Chart to Cluster
  }
}
