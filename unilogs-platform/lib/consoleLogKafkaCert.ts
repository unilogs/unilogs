import { AwsCredentialIdentity } from '@smithy/types';
import { EKSClient, DescribeClusterCommand } from '@aws-sdk/client-eks';
import fetch from 'node-fetch';
import https from 'https';
import EKSTokenGenerator from './getEksToken';

async function consoleLogKafkaCert(
  clusterName: string,
  credentials: AwsCredentialIdentity,
  region: string
) {
  const eksTokenGenerator = new EKSTokenGenerator(
    credentials,
    clusterName,
    region
  );
  const token = eksTokenGenerator.generate();

  const eksClient = new EKSClient({ credentials });
  const clusterData = await eksClient.send(
    new DescribeClusterCommand({ name: clusterName })
  );

  const endpoint = clusterData.cluster?.endpoint?.toLowerCase() as string;
  const caCert = Buffer.from(
    clusterData.cluster?.certificateAuthority?.data ?? '',
    'base64'
  ).toString('utf8');

  const secretUrl = `${endpoint}/api/v1/namespaces/kafka/secrets/kafka-tls`;
  const res = await fetch(secretUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    agent: new https.Agent({ ca: caCert }),
  });
  const body = (await res.json()) as { data: { 'ca.crt': string } };
  console.log('Kafka bootstrap servers TLS certificate:');
  console.log(body.data['ca.crt']);
}

export default consoleLogKafkaCert;
