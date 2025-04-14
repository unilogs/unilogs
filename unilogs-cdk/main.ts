import child_process from 'child_process';
import prompts from 'prompts';
import Credentials from './lib/Credentials';
import consoleLogLbUrls from './lib/consoleLogLbUrls';
import safeAssertString from './lib/safeAssertString';

async function main() {
  const { AWS_ACCESS_KEY_ID } = await prompts<string>({
    type: 'text',
    name: 'AWS_ACCESS_KEY_ID',
    message: 'AWS access key ID',
    hint: 'required',
    validate: (input: string) => /^[A-Z0-9]+$/.test(input),
  });
  const { AWS_SECRET_ACCESS_KEY } = await prompts<string>({
    type: 'text',
    name: 'AWS_SECRET_ACCESS_KEY',
    message: 'AWS secret access key',
    hint: 'required',
    validate: (input: string) => /^[\S]+$/.test(input),
  });
  const { AWS_SESSION_TOKEN } = await prompts<string>({
    type: 'text',
    name: 'AWS_SESSION_TOKEN',
    message: 'AWS session token (optional)',
    validate: (input: string) => /^[\S]*$/.test(input),
  });
  const { AWS_DEFAULT_ACCOUNT } = await prompts<string>({
    type: 'text',
    name: 'AWS_DEFAULT_ACCOUNT',
    message: 'AWS account ID',
    validate: (input: string) => /^[0-9]*$/.test(input),
  });
  const { AWS_DEFAULT_REGION } = await prompts<string>({
    type: 'text',
    name: 'AWS_DEFAULT_REGION',
    message: 'region',
    validate: (input: string) => /^[a-z0-9-]+$/.test(input),
  });
  const { AWS_USER_NAME } = await prompts<string>({
    type: 'text',
    name: 'AWS_USER_NAME',
    message: 'deploying username',
  });
  safeAssertString(AWS_ACCESS_KEY_ID);
  safeAssertString(AWS_SECRET_ACCESS_KEY);
  safeAssertString(AWS_SESSION_TOKEN);
  safeAssertString(AWS_DEFAULT_ACCOUNT);
  safeAssertString(AWS_DEFAULT_REGION);
  safeAssertString(AWS_USER_NAME);
  child_process.spawnSync(
    `PATH="${process.env.PATH}" && cdk bootstrap --verbose && cdk deploy --verbose --require-approval never`, // verbose flags for dev only
    {
      shell: true,
      stdio: 'inherit',
      env: {
        ...process.env,
        AWS_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY,
        AWS_SESSION_TOKEN,
        AWS_DEFAULT_ACCOUNT,
        AWS_DEFAULT_REGION,
        AWS_USER_NAME,
      },
    }
  );

  const awsCredentials = new Credentials(
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_SESSION_TOKEN,
    AWS_DEFAULT_ACCOUNT
  );
  
  void consoleLogLbUrls(awsCredentials);
}

void main();
