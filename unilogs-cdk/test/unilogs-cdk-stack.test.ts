import { Template } from 'aws-cdk-lib/assertions'; // don't use the outdated @aws-cdk/assertions package, which is for CDK v1
import * as cdk from "aws-cdk-lib";
import { UnilogsCdkStack } from "../lib/unilogs-cdk-stack";

test("UniLogs Stack creates 2 S3 Buckets for Loki", () => {
  const app = new cdk.App({
    context: {
      awsUserName: 'test-only-user',
      grafanaPassword: 'test-only-password',
    }
  });
  const stack = new UnilogsCdkStack(app, "UniLogsTestStack"); // causes error... needs review
  const template = Template.fromStack(stack);

  template.resourceCountIs("AWS::S3::Bucket", 2);
});
