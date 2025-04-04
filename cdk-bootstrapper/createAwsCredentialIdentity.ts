import prompts from 'prompts';
import { AwsCredentialIdentity } from '@smithy/types';
import safeAssertString from './utils/safeAssertString';

async function createAwsCredentialIdentity(): Promise<AwsCredentialIdentity> {

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
    message: 'AWS account ID',
    validate: (input: string) => /^[0-9]*$/.test(input),
  });

  safeAssertString(accessKeyId);
  safeAssertString(secretAccessKey);
  safeAssertString(sessionToken);
  safeAssertString(accountId);

  return {
    accessKeyId,
    secretAccessKey,
    sessionToken,
    accountId,
  };
}

export default createAwsCredentialIdentity;
