import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { UnilogsCdkStack } from '../lib/unilogs-cdk-stack';
import * as yaml from 'js-yaml';

describe('UnilogsCdkStack', () => {
  let app: cdk.App;
  let stack: UnilogsCdkStack;
  let template: cdk.assertions.Template;

  beforeAll(() => {
    app = new cdk.App();
    stack = new UnilogsCdkStack(app, 'TestStack');
    template = Template.fromStack(stack);
  });

  describe('VPC Configuration', () => {
    test('VPC is created with correct CIDR and AZs', () => {
      template.hasResourceProperties('AWS::EC2::VPC', {
        CidrBlock: '10.0.0.0/16',
        EnableDnsHostnames: true,
        EnableDnsSupport: true,
        Tags: Match.arrayWith([{ Key: 'Name', Value: 'TestStack/UniLogsVpc' }]),
      });
    });

    test('Has 1 NAT Gateway for cost optimization', () => {
      template.resourceCountIs('AWS::EC2::NatGateway', 1);
    });

    test('Has public and private subnets', () => {
      template.hasResourceProperties('AWS::EC2::Subnet', {
        MapPublicIpOnLaunch: true,
        Tags: Match.arrayWith([
          { Key: 'aws-cdk:subnet-type', Value: 'Public' },
        ]),
      });

      template.hasResourceProperties('AWS::EC2::Subnet', {
        Tags: Match.arrayWith([
          { Key: 'aws-cdk:subnet-type', Value: 'Private' },
        ]),
      });
    });
  });

  describe('MSK Cluster', () => {
    test('MSK Cluster has IAM authentication enabled', () => {
      template.hasResourceProperties('AWS::MSK::Cluster', {
        ClientAuthentication: {
          Sasl: { Iam: { Enabled: true } },
        },
      });
    });

    test('MSK uses TLS encryption in transit', () => {
      template.hasResourceProperties('AWS::MSK::Cluster', {
        EncryptionInfo: {
          EncryptionInTransit: {
            ClientBroker: 'TLS',
            InCluster: true,
          },
        },
      });
    });

    test('Security group allows EKS traffic', () => {
      template.hasResourceProperties('AWS::EC2::SecurityGroup', {
        SecurityGroupIngress: Match.arrayWith([
          Match.objectLike({
            FromPort: 9092,
            ToPort: 9098,
            IpProtocol: 'tcp',
          }),
        ]),
      });
    });
  });

  describe('EKS Cluster', () => {
    test('Fargate cluster created with correct version', () => {
      template.hasResourceProperties('Custom::AWSCDK-EKS-Cluster', {
        Config: Match.objectLike({
          name: 'unilogs-cluster',
          version: '1.32',
        }),
      });
    });

    test('Fargate profile has pod execution role', () => {
      template.hasResourceProperties('AWS::IAM::Role', {
        AssumeRolePolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Principal: { Service: 'eks-fargate-pods.amazonaws.com' },
            }),
          ]),
        }),
      });
    });
  });

  describe('Loki Configuration', () => {
    test('S3 buckets have secure configurations', () => {
      // First check bucket encryption
      template.hasResourceProperties('AWS::S3::Bucket', {
        BucketEncryption: Match.objectLike({
          ServerSideEncryptionConfiguration: Match.arrayWith([
            { ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } },
          ]),
        }),
      });

      // Then check public access block configuration exists
      template.hasResource('AWS::S3::Bucket', {
        Properties: Match.objectLike({
          PublicAccessBlockConfiguration: Match.objectLike({
            BlockPublicAcls: true,
            BlockPublicPolicy: true,
            IgnorePublicAcls: true,
            RestrictPublicBuckets: true,
          }),
        }),
      });
    });

    test('Loki service account has S3 access', () => {
      template.hasResourceProperties('AWS::IAM::Role', {
        Policies: Match.arrayWith([
          Match.objectLike({
            PolicyDocument: Match.objectLike({
              Statement: Match.arrayWith([
                Match.objectLike({
                  Action: Match.arrayWith(['s3:PutObject', 's3:GetObject']),
                  Effect: 'Allow',
                }),
              ]),
            }),
          }),
        ]),
      });
    });
  });

  describe('Vector Configuration', () => {
    test('Vector has MSK access permissions', () => {
      template.hasResourceProperties('AWS::IAM::Policy', {
        PolicyDocument: Match.objectLike({
          Statement: Match.arrayWith([
            Match.objectLike({
              Action: Match.arrayWith([
                'kafka-cluster:Connect',
                'kafka-cluster:Read',
              ]),
              Effect: 'Allow',
            }),
          ]),
        }),
      });
    });

    test('Vector Helm chart has correct config', () => {
      // First find the vector chart
      const vectorCharts = template.findResources('Custom::AWSCDK-EKS-HelmChart', {
        Properties: {
          Chart: 'vector',
          Namespace: 'vector'
        }
      });
      
      // Verify we found exactly one vector chart
      expect(Object.keys(vectorCharts).length).toBe(1);
      
      // Get the first (and only) vector chart
      const vectorChart = Object.values(vectorCharts)[0];
      
      // Verify the role is set to 'Agent'
      expect(vectorChart.Properties.Values).toMatchObject({
        role: 'Agent'
      });
      
      // Verify customConfig exists and has the required structure
      expect(vectorChart.Properties.Values.customConfig).toBeDefined();
      expect(vectorChart.Properties.Values.customConfig.sources).toBeDefined();
      expect(vectorChart.Properties.Values.customConfig.sinks).toBeDefined();
    });
  });

  describe('Grafana Configuration', () => {
    test('Grafana uses Loki datasource', () => {
      // First find the grafana chart
      const grafanaCharts = template.findResources('Custom::AWSCDK-EKS-HelmChart', {
        Properties: {
          Chart: 'grafana',
          Namespace: 'grafana'
        }
      });
      
      // Verify we found exactly one grafana chart
      expect(Object.keys(grafanaCharts).length).toBe(1);
      
      // Get the first (and only) grafana chart
      const grafanaChart = Object.values(grafanaCharts)[0];
      
      // Verify datasources configuration
      expect(grafanaChart.Properties.Values.datasources).toBeDefined();
      expect(grafanaChart.Properties.Values.datasources['datasources.yaml']).toBeDefined();
      expect(grafanaChart.Properties.Values.datasources['datasources.yaml'].datasources).toBeDefined();
      
      // Find the Loki datasource
      const lokiDatasource = grafanaChart.Properties.Values.datasources['datasources.yaml']
        .datasources.find((ds: any) => ds.type === 'loki');
      
      expect(lokiDatasource).toBeDefined();
      expect(lokiDatasource.url).toBe('http://loki-gateway.loki.svc.cluster.local');
    });
  });

  describe('Security Validation', () => {
    test('No resources have public access', () => {
      // Get all S3 buckets
      const buckets = template.findResources('AWS::S3::Bucket');
      
      // Verify each bucket has public access blocked
      Object.values(buckets).forEach(bucket => {
        expect(bucket.Properties.PublicAccessBlockConfiguration).toBeDefined();
        expect(bucket.Properties.PublicAccessBlockConfiguration.BlockPublicAcls).toBe(true);
      });
    });
  });

  describe('Dependency Validation', () => {
    test('Vector depends on MSK and Loki', () => {
      // Find the vector chart
      const vectorCharts = template.findResources('Custom::AWSCDK-EKS-HelmChart', {
        Properties: { Chart: 'vector' }
      });
      
      // Get dependencies
      const dependencies = Object.values(vectorCharts)[0].DependsOn || [];
      
      // Find MSK broker resource
      const mskBrokers = template.findResources('Custom::AWS', {
        Properties: {
          Service: 'Kafka',
          Action: 'getBootstrapBrokers'
        }
      });
      
      // Find Loki gateway service
      const lokiServices = template.findResources('Custom::AWSCDK-EKS-KubernetesResource', {
        Properties: {
          Manifest: Match.serializedJson(
            Match.objectLike({
              kind: 'Service',
              metadata: Match.objectLike({
                name: 'loki-gateway'
              })
            })
          )
        }
      });
      
      // Verify we have the required dependencies
      expect(dependencies).toContain(Object.keys(mskBrokers)[0]);
      expect(dependencies).toContain(Object.keys(lokiServices)[0]);
    });
  });

  describe('Vector Helm Configuration', () => {
    let vectorValues: any;

    beforeAll(() => {
      const vectorCharts = template.findResources('Custom::AWSCDK-EKS-HelmChart', {
        Properties: { Chart: 'vector' }
      });
      
      const chart = Object.values(vectorCharts)[0].Properties;
      
      // Handle Fn::Join syntax in Values
      if (typeof chart.Values === 'object' && 'Fn::Join' in chart.Values) {
        // This is a simplified approach - in reality you'd need to properly evaluate the Join
        const joined = chart.Values['Fn::Join'][1].join('');
        vectorValues = JSON.parse(joined);
      } else {
        vectorValues = chart.Values;
      }
    });

    test('Custom config has valid structure', () => {
      expect(vectorValues).toBeDefined();
      expect(vectorValues.role).toBe('Agent');
      expect(vectorValues.customConfig).toBeDefined();
    });

    test('Kafka source configuration is properly formatted', () => {
      expect(vectorValues.customConfig.sources).toBeDefined();
      expect(vectorValues.customConfig.sources.kafka).toBeDefined();
      expect(vectorValues.customConfig.sources.kafka.type).toBe('kafka');
      expect(vectorValues.customConfig.sources.kafka.security_protocol).toBe('sasl_ssl');
      expect(vectorValues.customConfig.sources.kafka.sasl.mechanism).toBe('aws_msk_iam');
    });

    test('Loki sink labels use correct template syntax', () => {
      expect(vectorValues.customConfig.sinks.loki.labels.unilogs).toMatch(
        /^{{ ?test_label ?}}$/
      );
    });

    test('Required components exist in config', () => {
      expect(vectorValues.customConfig.sinks.loki.inputs).toContain('kafka');
    });
  });
});