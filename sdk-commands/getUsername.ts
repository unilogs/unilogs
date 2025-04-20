import dotenv from 'dotenv';
import { IAMClient, GetUserCommand } from '@aws-sdk/client-iam';
import safeAssertString from './utils/safeAssertString';
import { AwsCredentialIdentity } from '@smithy/types';

dotenv.config();

async function main() {
  safeAssertString(process.env.AWS_ACCESS_KEY_ID);
  safeAssertString(process.env.AWS_SECRET_ACCESS_KEY);
  safeAssertString(process.env.AWS_SESSION_TOKEN);
  safeAssertString(process.env.AWS_REGION);
  safeAssertString(process.env.AWS_ACCOUNT);
  safeAssertString(process.env.AWS_USER);
  const credentials: AwsCredentialIdentity = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
    accountId: process.env.AWS_ACCOUNT,
  };
  
  const iamClient = new IAMClient({credentials});

  const user = await iamClient.send(new GetUserCommand());
  console.log(user);
}

void main();