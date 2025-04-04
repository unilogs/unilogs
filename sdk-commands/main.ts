import prompts from 'prompts';
import createAwsCredentialIdentity from './utils/createAwsCredentialIdentity';
import createCloudFormationClient from './utils/createCloudFormationClient';
import safeAssertString from './utils/safeAssertString';
import getStackResourcesList from './utils/getStackResourceList';
import getKafkaBrokers from './utils/getKafkaBrokers';

async function main() {
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

  const stackResourcesList = await getStackResourcesList({
    stackName,
    cloudFormationClient,
  });

  const kafkaArn = stackResourcesList.StackResourceSummaries?.filter(
    (resourceSummary) => resourceSummary.ResourceType === 'AWS::MSK::Cluster'
  )[0].PhysicalResourceId ?? '';
  
  const kafkaBootstrapBrokers = await getKafkaBrokers({kafkaArn, region, credentials});

  console.log(kafkaBootstrapBrokers);
}

void main();
