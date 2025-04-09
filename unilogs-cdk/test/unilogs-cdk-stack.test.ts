import { Template } from 'aws-cdk-lib/assertions'; // don't use the outdated @aws-cdk/assertions package, which is for CDK v1
import * as cdk from "aws-cdk-lib";
import { UnilogsCdkStack } from "../lib/unilogs-cdk-stack";

test("UniLogs Stack creates 3 S3 Buckets, 1 for bootstrap, 2 for Loki", () => {
  const app = new cdk.App();
  const stack = new UnilogsCdkStack(app, "UniLogsTestStack"); // causes error... needs review
  const template = Template.fromStack(stack);

  template.resourceCountIs("AWS::S3::Bucket", 3);
});
