#!/usr/bin/env node

import child_process from 'child_process';
import prompts from 'prompts';
import Credentials from './lib/Credentials';
import consoleLogLbUrls from './lib/consoleLogLbUrls';
import consoleLogKafkaCert from './lib/consoleLogKafkaCert';
import safeAssertString from './lib/safeAssertString';
import logo from './lib/logo';

async function main() {
    console.clear();
    console.log(logo);
  console.log(
    "First we need a little information for the AWS account that you're using to deploy Unilogs."
  );
  console.log(
    'You must use a user account that has sufficient permissions to create all the necessary resources.'
  );
  console.log('Also the account cannot be root.');
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
    message: 'AWS session token (if applicable)',
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
    message: 'AWS username (for deploying account)',
  });
  console.log(
    '\nNext you need to choose a username and password to use for authenticating shippers so they can send logs securely.'
  );
  console.log('(Make a note of these as you will need them to set up the shippers.)');
  const { KAFKA_SASL_USERNAME } = await prompts<string>({
    type: 'text',
    name: 'KAFKA_SASL_USERNAME',
    message: 'New Kafka username',
  });
  const { KAFKA_SASL_PASSWORD } = await prompts<string>({
    type: 'text',
    name: 'KAFKA_SASL_PASSWORD',
    message: 'New Kafka password',
  });
  console.log(
    '\nFinally, you need to choose a username and password to use for administering Grafana (the interface to query your logs).'
  );
  console.log('(Make a note of these as you will need them to connect to Grafana to create visualizations, etc.)');
  const { GRAFANA_ADMIN_USERNAME } = await prompts<string>({
    type: 'text',
    name: 'GRAFANA_ADMIN_USERNAME',
    message: 'New Grafana admin username',
  });
  const { GRAFANA_ADMIN_PASSWORD } = await prompts<string>({
    type: 'text',
    name: 'GRAFANA_ADMIN_PASSWORD',
    message: 'New Grafana admin password',
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
    `PATH="${process.env.PATH}" && cdk bootstrap && cdk deploy --require-approval never`,
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
        GRAFANA_ADMIN_PASSWORD,
      },
    }
  );

  const awsCredentials = new Credentials(
    AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY,
    AWS_SESSION_TOKEN,
    AWS_DEFAULT_ACCOUNT
  );

  console.log(
    "Please note down the following information as you'll need it to access Grafana and configure the shipper to send logs.\n"
  );
  void consoleLogLbUrls(awsCredentials);
  console.log();
  void consoleLogKafkaCert(
    'unilogs-cluster',
    awsCredentials,
    AWS_DEFAULT_REGION
  );
}

void main();
