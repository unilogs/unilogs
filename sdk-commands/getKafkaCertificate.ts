import dotenv from 'dotenv';
import { AwsCredentialIdentity } from '@smithy/types';
import safeAssertString from './utils/safeAssertString';
import { EKSClient, DescribeClusterCommand } from '@aws-sdk/client-eks';
import fetch from "node-fetch";
import https from 'https';
import EKSTokenGenerator from './getEksToken';
dotenv.config();
// import EKSToken from 'aws-eks-token';

async function main(clusterName: string) {
  // const token = await EKSToken.renew(clusterName);

  safeAssertString(process.env.AWS_ACCESS_KEY_ID);
  safeAssertString(process.env.AWS_SECRET_ACCESS_KEY);
  safeAssertString(process.env.AWS_SESSION_TOKEN);
  safeAssertString(process.env.AWS_REGION);
  safeAssertString(process.env.AWS_ACCOUNT);
  safeAssertString(process.env.AWS_USER);
  const credentials: AwsCredentialIdentity = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
    accountId: process.env.AWS_ACCOUNT,
  };
  const eksTokenGenerator = new EKSTokenGenerator(credentials,'unilogs-cluster', process.env.AWS_REGION);
  const token = eksTokenGenerator.generate();

  const eksClient = new EKSClient({ credentials });
  const clusterData = await eksClient.send(
    new DescribeClusterCommand({ name: clusterName })
  );

  const endpoint = clusterData.cluster?.endpoint?.toLowerCase() as string;
  const caCert = Buffer.from(clusterData.cluster?.certificateAuthority
    ?.data ?? '', 'base64').toString('utf8');
    
  const secretUrl = `${endpoint}/api/v1/namespaces/kafka/secrets/kafka-tls`;
  const res = await fetch(secretUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    },
    // In production, verify with the CA cert properly
    agent: new https.Agent({ca: caCert})
  });
  const body = await res.json() as {data: {'ca.crt': string}};
  console.log(body.data['ca.crt']);
  console.log(Buffer.from(body.data['ca.crt'], 'base64').toString('utf8')); 
}
void main('unilogs-cluster');
