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
    message: 'AWS Region',
    validate: (input: string) => /^[a-z0-9-]+$/.test(input),
  });
  const { AWS_USER_NAME } = await prompts<string>({
    type: 'text',
    name: 'AWS_USER_NAME',
    message: 'Deploying Username',
  });
  const { KAFKA_SASL_USERNAME } = await prompts<string>({
    type: 'text',
    name: 'KAFKA_SASL_USERNAME',
    message: 'Kafka Sasl Username',
  });
  const { KAFKA_SASL_PASSWORD } = await prompts<string>({
    type: 'text',
    name: 'KAFKA_SASL_PASSWORD',
    message: 'Kafka Sasl Password',
  });
  const { GRAFANA_ADMIN_USERNAME } = await prompts<string>({
    type: 'text',
    name: 'GRAFANA_ADMIN_USERNAME',
    message: 'Grafana Admin Username',
  });
  const { GRAFANA_ADMIN_PASSWORD } = await prompts<string>({
    type: 'text',
    name: 'GRAFANA_ADMIN_PASSWORD',
    message: 'Grafana Admin Password',
  });
  safeAssertString(AWS_ACCESS_KEY_ID);
  safeAssertString(AWS_SECRET_ACCESS_KEY);
  safeAssertString(AWS_SESSION_TOKEN);
  safeAssertString(AWS_DEFAULT_ACCOUNT);
  safeAssertString(AWS_DEFAULT_REGION);
  safeAssertString(AWS_USER_NAME);
  safeAssertString(KAFKA_SASL_USERNAME);
  safeAssertString(KAFKA_SASL_PASSWORD);
  safeAssertString(GRAFANA_ADMIN_USERNAME);
  safeAssertString(GRAFANA_ADMIN_PASSWORD);
  child_process.spawnSync(
    `PATH="${process.env.PATH}" && cdk bootstrap --output cdk.out-west2 && cdk deploy --require-approval never --output cdk.out-west2`,
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
        KAFKA_SASL_USERNAME,
        KAFKA_SASL_PASSWORD,
        GRAFANA_ADMIN_USERNAME,
        GRAFANA_ADMIN_PASSWORD
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
