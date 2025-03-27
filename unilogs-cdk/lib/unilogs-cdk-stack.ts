import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as msk from 'aws-cdk-lib/aws-msk';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cr from 'aws-cdk-lib/custom-resources';

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
  }
}