import {
  CloudFormationClient,
  CloudFormationClientConfig,
} from '@aws-sdk/client-cloudformation';
import prompts from 'prompts';
import safeAssertString from './utils/safeAssertString';
import createAwsCredentialIdentity from './createAwsCredentialIdentity';

async function createCloudFormationClient(): Promise<CloudFormationClient> {
  const { region } = await prompts<string>({
    type: 'text',
    name: 'region',
    message: 'region',
    hint: 'required',
    validate: (input: string) => /^[a-z0-9-]+$/.test(input),
  });
  safeAssertString(region);

  const credentials = await createAwsCredentialIdentity();

  const config: CloudFormationClientConfig = { region, credentials };

  return new CloudFormationClient(config);
}

export default createCloudFormationClient;
