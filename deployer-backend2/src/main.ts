import { UnilogsStack } from './stack';
import {
  CloudFormationClient,
  CreateStackCommand,
  // DescribeStacksCommand,
} from '@aws-sdk/client-cloudformation';
import { App} from 'aws-cdk-lib';
import { CloudFormationStackArtifact } from 'aws-cdk-lib/cx-api';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';

dotenv.config();

function createCloudFormationClient(): CloudFormationClient {
  // TODO: add parameters and types
  // TODO: wrap this in a try/catch block
  return new CloudFormationClient({
    region: process.env.REGION ?? '',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
      sessionToken: process.env.AWS_SESSION_TOKEN ?? '',
    },
  });
}

function synthesizeTemplate(): CloudFormationStackArtifact {
  const app = new App();
  new UnilogsStack(app, 'UnilogsStack');
  const synthesizedTemplate = app.synth().getStackByName('UnilogsStack')
    .template as CloudFormationStackArtifact;
  return synthesizedTemplate;
}

async function bootstrapEnvironment(cfClient: CloudFormationClient) {
  const bootstrapTemplate = readFileSync('./bootstrap-template.yaml', 'utf8');

  await cfClient.send(
    new CreateStackCommand({
      StackName: 'CDKToolkit',
      TemplateBody: bootstrapTemplate,
      Capabilities: ['CAPABILITY_NAMED_IAM'],
    })
  );
}

async function deployStack(
  cfClient: CloudFormationClient,
  synthesizedTemplate: CloudFormationStackArtifact
) {
  // await bootstrapEnvironment(cfClient);
  const createCommand = new CreateStackCommand({
    StackName: 'UnilogsStack',
    TemplateBody: JSON.stringify(synthesizedTemplate),
    Capabilities: ['CAPABILITY_NAMED_IAM'],
  });
  await cfClient.send(createCommand);
}

const cfClient = createCloudFormationClient();
const synthesizedTemplate = synthesizeTemplate();

void deployStack(cfClient, synthesizedTemplate);
