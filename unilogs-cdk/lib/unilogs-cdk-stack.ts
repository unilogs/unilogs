import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as msk from 'aws-cdk-lib/aws-msk';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as eks from 'aws-cdk-lib/aws-eks';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { KubectlV31Layer as KubectlLayer } from '@aws-cdk/lambda-layer-kubectl-v31';

export class UnilogsCdkStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a VPC with 2 AZs for high availability
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

    // Output the VPC ID for reference
    new cdk.CfnOutput(this, 'VpcId', { value: vpc.vpcId });

    // MSK Cluster Security Group
    const mskSecurityGroup = new ec2.SecurityGroup(this, 'MskSecurityGroup', {
      vpc,
      description: 'Security group for MSK cluster',
      allowAllOutbound: true,
    });

    mskSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),
      ec2.Port.tcpRange(9092, 9098),
      'Allow from EKS pods'
    );

    // Create the MSK Cluster
    const mskCluster = new msk.CfnCluster(this, 'UniLogsKafka', {
      clusterName: 'unilogs-kafka',
      kafkaVersion: '3.6.0',
      numberOfBrokerNodes: 2,

      brokerNodeGroupInfo: {
        instanceType: 'kafka.m5.large',
        clientSubnets: vpc.selectSubnets({
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }).subnetIds,
        securityGroups: [mskSecurityGroup.securityGroupId],
        storageInfo: {
          ebsStorageInfo: {
            volumeSize: 100,
          },
        },
      },

      clientAuthentication: {
        unauthenticated: {
          enabled: true,
        },
      },

      encryptionInfo: {
        encryptionInTransit: {
          clientBroker: 'PLAINTEXT',
        },
      },
    });

    // Create a role for the custom resource
    const mskBrokersRole = new iam.Role(this, 'MskBrokersRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    mskBrokersRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['kafka:GetBootstrapBrokers', 'kafka:DescribeCluster'],
        resources: [mskCluster.attrArn],
      })
    );

    // Create the custom resource to get bootstrap brokers
    const mskBrokers = new cr.AwsCustomResource(this, 'MskBootstrapBrokers', {
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: cr.AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
      onCreate: {
        service: 'Kafka',
        action: 'getBootstrapBrokers',
        parameters: {
          ClusterArn: mskCluster.attrArn,
        },
        physicalResourceId: cr.PhysicalResourceId.of('MskBootstrapBrokers'),
      },
      role: mskBrokersRole,
    });

    // Output the bootstrap brokers - ONLY USE THE CUSTOM RESOURCE VERSION
    new cdk.CfnOutput(this, 'KafkaBootstrapServers', {
      value: mskBrokers.getResponseField('BootstrapBrokerString'),
    });

    // Create the EKS Fargate Cluster with kubectl layer
    const cluster = new eks.FargateCluster(this, 'FargateCluster', {
      vpc,
      version: eks.KubernetesVersion.V1_32,
      kubectlLayer: new KubectlLayer(this, 'kubectl'),
      // No kubectlLayer needed in v2.100.0
    });

    // Add permissions for the cluster to access MSK
    cluster.awsAuth.addRoleMapping(
      new iam.Role(this, 'KafkaAccessRole', {
        assumedBy: new iam.ServicePrincipal('eks.amazonaws.com'),
        inlinePolicies: {
          mskAccess: new iam.PolicyDocument({
            statements: [
              new iam.PolicyStatement({
                actions: ['kafka:DescribeCluster', 'kafka:GetBootstrapBrokers'],
                resources: [mskCluster.attrArn],
              }),
            ],
          }),
        },
      }),
      {
        groups: ['system:masters'],
      }
    );

    // Output cluster info
    new cdk.CfnOutput(this, 'ClusterName', { value: cluster.clusterName });

    // Make EKS depend on MSK being ready
    cluster.node.addDependency(mskCluster);
  }
}
