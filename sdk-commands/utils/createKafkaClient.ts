import { KafkaClient, KafkaClientConfig } from "@aws-sdk/client-kafka";
import { AwsCredentialIdentity } from "@smithy/types";

export interface createKafkaClientProps {
  region: string;
  credentials: AwsCredentialIdentity;
}

function createKafkaClient(props: createKafkaClientProps): KafkaClient {

  const config: KafkaClientConfig = { region: props.region, credentials: props.credentials };

  return new KafkaClient(config);
}

export default createKafkaClient;
