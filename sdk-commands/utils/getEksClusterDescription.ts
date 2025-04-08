import createEksClient from './createEksClient';
import { DescribeClusterCommand } from '@aws-sdk/client-eks';
import { AwsCredentialIdentity } from '@smithy/types';

export interface getEksClusterDescriptionProps {
  name: string;
  region: string;
  credentials: AwsCredentialIdentity; 
}

async function getEksClusterDescrption(props: getEksClusterDescriptionProps) {

  const eksClient = createEksClient({region: props.region, credentials: props.credentials});

  return await eksClient.send(
    new DescribeClusterCommand({ name: props.name })
  );

}

export default getEksClusterDescrption;