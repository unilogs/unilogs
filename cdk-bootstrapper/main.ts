import { CreateStackCommand } from '@aws-sdk/client-cloudformation';
import createCloudFormationClient from './createCloudFormationClient';
import { readFileSync } from 'fs';

async function main() {
  
  const bootstrapTemplate = readFileSync('./bootstrap-template.yaml', 'utf8');

  const cloudFormationClient = await createCloudFormationClient();

  await cloudFormationClient.send(
    new CreateStackCommand({
      StackName: 'CDKToolkit',
      TemplateBody: bootstrapTemplate,
      Capabilities: ['CAPABILITY_NAMED_IAM'],
    })
  );
}

void main();
