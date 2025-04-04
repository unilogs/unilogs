import {
  CloudFormationClient,
  CloudFormationClientConfig,
} from '@aws-sdk/client-cloudformation';
import prompts from 'prompts';
import { AwsCredentialIdentity } from '@smithy/types';

function safeAssertString(val: unknown): asserts val is string {
  if (typeof val !== 'string') throw new Error('Expected a string.');
}

async function createCloudFormationClient(): Promise<CloudFormationClient> {
  const { accessKeyId } = await prompts<string>({
    type: 'text',
    name: 'accessKeyId',
    message: 'AWS access key ID',
    hint: 'required',
    validate: (input: string) => /^[A-Z0-9]+$/.test(input),
  });
  const { secretAccessKey } = await prompts<string>({
    type: 'text',
    name: 'secretAccessKey',
    message: 'AWS secret access key',
    hint: 'required',
    validate: (input: string) => /^[\S]+$/.test(input),
  });
  const { sessionToken } = await prompts<string>({
    type: 'text',
    name: 'sessionToken',
    message: 'AWS session token',
    validate: (input: string) => /^[\S]*$/.test(input),
  });
  const { accountId } = await prompts<string>({
    type: 'text',
    name: 'accountId',
    message: 'AWS accound ID',
    validate: (input: string) => /^[0-9]*$/.test(input),
  });
  const { region } = await prompts<string>({
    type: 'text',
    name: 'region',
    message: 'region',
    hint: 'required',
    validate: (input: string) => /^[a-z0-9\-]+$/.test(input),
  });
  safeAssertString(accessKeyId);
  safeAssertString(secretAccessKey);
  safeAssertString(sessionToken);
  safeAssertString(accountId);
  safeAssertString(region);

  const credentials: AwsCredentialIdentity = {
    accessKeyId,
    secretAccessKey,
    sessionToken,
    accountId,
  };
  const config: CloudFormationClientConfig = { region, credentials };
  
  return new CloudFormationClient(config);
}

export default createCloudFormationClient;
