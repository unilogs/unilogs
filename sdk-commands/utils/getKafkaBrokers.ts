import createKafkaClient from './createKafkaClient';
import { GetBootstrapBrokersCommand } from '@aws-sdk/client-kafka';
import { AwsCredentialIdentity } from '@smithy/types';

export interface getKafkaBrokersProps {
  kafkaArn: string;
  region: string;
  credentials: AwsCredentialIdentity; 
}

async function getKafkaBrokers(props: getKafkaBrokersProps) {

  const kafkaClient = createKafkaClient({region: props.region, credentials: props.credentials});

  const bootstrapBrokerInfo = await kafkaClient.send(
    new GetBootstrapBrokersCommand({ ClusterArn: props.kafkaArn })
  );

  return bootstrapBrokerInfo;
}

export default getKafkaBrokers;