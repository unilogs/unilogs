import { config as dotenvConfig } from 'dotenv';
import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import { CloudFormationClient, CreateStackCommand, DescribeStacksCommand } from '@aws-sdk/client-cloudformation';
import { CloudFormationStackArtifact } from 'aws-cdk-lib/cx-api';

dotenvConfig();

async function deployStack(cfClient: CloudFormationClient, synthesizedTemplate: CloudFormationStackArtifact) {
  try {
    // Check if stack already exists
    const describeCommand = new DescribeStacksCommand({ StackName: "S3Stack" });
    await cfClient.send(describeCommand);
    console.log("✅ Stack already exists. No changes applied.");
  } catch (error: any) {
    if (error.name === "ValidationError") {
      console.log("🚀 Deploying new stack...");

      // Deploy stack using synthesized template
      const createCommand = new CreateStackCommand({
        StackName: "S3Stack",
        TemplateBody: JSON.stringify(synthesizedTemplate),
        Capabilities: ["CAPABILITY_NAMED_IAM"],
      });

      const response = await cfClient.send(createCommand);
      console.log("✅ Stack creation initiated:", response);
    } else {
      console.error("❌ Error describing stack:", error);
    }
  }
}

class UnilogsStorageStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    new s3.Bucket(this, 'unilogs-bucket', {
      bucketName: `unilogs-s3-bucket-${Date.now()}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    });
  }
}

const app = new cdk.App();
new UnilogsStorageStack(app, 'UnilogsStorageStack');

try {
  const synthesizedTemplate = app
    .synth()
    .getStackByName('UnilogsStorageStack')?.template;
  
  if (!synthesizedTemplate) throw new Error('Could not synthesize template');

  const cfClient = new CloudFormationClient({
    region: process.env.REGION ?? '',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      sessionToken: process.env.AWS_SESSION_TOKEN ?? ''
    }
  });

  deployStack(cfClient, synthesizedTemplate);

} catch (error) {
  const errorMessage =
    error instanceof Error ? error.message : 'Could not synthesize template';
  console.error(errorMessage);
}
