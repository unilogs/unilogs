import { Template } from 'aws-cdk-lib/assertions';
import * as cdk from "aws-cdk-lib";
import { UnilogsCdkStack } from "../lib/unilogs-cdk-stack";

describe("UniLogs Infrastructure", () => {
  let template: Template;
  
  beforeAll(() => {
    const app = new cdk.App({
      context: {
        awsUserName: 'test-user',
        grafanaAdminPassword: 'test-password',
      }
    });
    const stack = new UnilogsCdkStack(app, "UniLogsTestStack");
    template = Template.fromStack(stack);
  });

  test("Core Resources Exist", () => {
    template.resourceCountIs("AWS::S3::Bucket", 2);
    template.resourceCountIs("AWS::EC2::VPC", 1);
    template.resourceCountIs("Custom::AWSCDK-EKS-Cluster", 1);
    template.resourceCountIs("AWS::EKS::Nodegroup", 1);
  });

  test("Security Groups Configured", () => {
    template.hasResourceProperties("AWS::EC2::SecurityGroup", {
      SecurityGroupIngress: [
        { Description: "Allow internal VPC traffic" },
        { Description: "Allow all traffic" }
      ]
    });
  });

  test("IAM Roles Configuration", () => {
    template.hasResourceProperties("AWS::IAM::Role", {
      ManagedPolicyArns: [
        { "Fn::Join": ["", ["arn:", { Ref: "AWS::Partition" }, ":iam::aws:policy/AmazonEKSWorkerNodePolicy"]] },
        { "Fn::Join": ["", ["arn:", { Ref: "AWS::Partition" }, ":iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"]] },
        { "Fn::Join": ["", ["arn:", { Ref: "AWS::Partition" }, ":iam::aws:policy/AmazonEKS_CNI_Policy"]] }
      ]
    });
  });

  test("Kubernetes Components Exist", () => {
    const helmCharts = [
      "aws-ebs-csi-driver",
      "kafka", 
      "loki",
      "grafana",
      "vector"
    ];
    
    helmCharts.forEach(chart => {
      template.hasResourceProperties("Custom::AWSCDK-EKS-HelmChart", {
        Chart: chart
      });
    });
  });

  test("Essential Outputs Exist", () => {
    ["ClusterName", "VpcId", "GrafanaURLCommand"].forEach(outputId => {
      template.hasOutput(outputId, {});
    });
  });
});
