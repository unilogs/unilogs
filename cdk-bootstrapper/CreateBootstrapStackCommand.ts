import { CreateStackCommand } from '@aws-sdk/client-cloudformation';
import { readFileSync } from 'fs';

const bootstrapTemplate = readFileSync('./bootstrap-template.yaml', 'utf8');

export class CreateBootstrapStackCommand extends CreateStackCommand {
  constructor() {
    super({
      StackName: 'CDKToolkit',
      TemplateBody: bootstrapTemplate,
      Capabilities: ['CAPABILITY_NAMED_IAM'],
    });
  }
}
