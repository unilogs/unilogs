import { CreateStackCommand } from '@aws-sdk/client-cloudformation';
import createCloudFormationClient from './createCloudFormationClient';
import { readFileSync } from 'fs';
import createAwsCredentialIdentity from './createAwsCredentialIdentity';
import prompts from 'prompts';
import safeAssertString from './safeAssertString';

async function createBootstrapStack() {
  const bootstrapTemplate = readFileSync('./bootstrap-template.yaml', 'utf8');
  const credentials = await createAwsCredentialIdentity();
  const { region } = await prompts<string>({
    type: 'text',
    name: 'region',
    message: 'region',
  });
  safeAssertString(region);
  const cloudFormationClient = createCloudFormationClient({
    region,
    credentials,
  });

  await cloudFormationClient.send(
    new CreateStackCommand({
      StackName: 'CDKToolkit',
      TemplateBody: bootstrapTemplate,
      Capabilities: ['CAPABILITY_NAMED_IAM'],
    })
  );
}

void createBootstrapStack();
