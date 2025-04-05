import createAwsCredentialIdentity from './utils/createAwsCredentialIdentity';
import prompts from 'prompts';
import createCloudFormationClient from './utils/createCloudFormationClient';
import getStackResourcesList from './utils/getStackResourceList';
import safeAssertString from './utils/safeAssertString';

async function monitorStackStatus() {
  const credentials = await createAwsCredentialIdentity();

  const { region } = await prompts<string>({
    type: 'text',
    name: 'region',
    message: 'region',
  });
  safeAssertString(region);
  const { stackName } = await prompts<string>({
    type: 'text',
    name: 'stackName',
    message: 'StackName',
    initial: 'UnilogsCdkStack',
  });
  safeAssertString(stackName);

  const cloudFormationClient = createCloudFormationClient({
    region,
    credentials,
  });
  setInterval(() => {
    const stackResourcesList = async () => {
      return await getStackResourcesList({
        stackName,
        cloudFormationClient,
      });
    };
    console.log(stackResourcesList());
  }, 30000);
}

void monitorStackStatus();
