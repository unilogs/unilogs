import { CloudFormationClient, ListStackResourcesCommand } from '@aws-sdk/client-cloudformation';

export interface getStackResourcesListProps {
  stackName: string;
  cloudFormationClient: CloudFormationClient;
}
async function getStackResourcesList(props: getStackResourcesListProps) {

  const resourcesList = await props.cloudFormationClient.send(
    new ListStackResourcesCommand({
      StackName: props.stackName,
    })
  );

  return resourcesList;
}

export default getStackResourcesList;