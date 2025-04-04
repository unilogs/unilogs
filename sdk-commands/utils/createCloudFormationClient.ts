import {
  CloudFormationClient,
  CloudFormationClientConfig,
} from '@aws-sdk/client-cloudformation';
import { AwsCredentialIdentity } from '@smithy/types';

export interface createCloudFormationClientProps {
  region: string;
  credentials: AwsCredentialIdentity;
}

function createCloudFormationClient(
  props: createCloudFormationClientProps
): CloudFormationClient {

  const config: CloudFormationClientConfig = { region: props.region, credentials: props.credentials };

  return new CloudFormationClient(config);
}

export default createCloudFormationClient;
