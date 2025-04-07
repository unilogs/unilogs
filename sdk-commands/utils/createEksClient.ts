import { EKSClient, EKSClientConfig } from "@aws-sdk/client-eks";
import { AwsCredentialIdentity } from "@smithy/types";

export interface createEksClientProps {
  region: string;
  credentials: AwsCredentialIdentity;
}

function createEksClient(props: createEksClientProps): EKSClient {

  const config: EKSClientConfig = { region: props.region, credentials: props.credentials };

  return new EKSClient(config);
}

export default createEksClient;
