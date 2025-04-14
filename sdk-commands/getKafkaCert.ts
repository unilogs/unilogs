import * as dotenv from 'dotenv';
import { EKSClient, DescribeClusterCommand } from '@aws-sdk/client-eks';
import fetch from 'node-fetch';
import { Buffer } from 'buffer';
import safeAssertString from './utils/safeAssertString';
// import { decode } from 'punycode';

dotenv.config();
safeAssertString(process.env.AWS_ACCESS_KEY_ID);
safeAssertString(process.env.AWS_SECRET_ACCESS_KEY);
safeAssertString(process.env.AWS_SESSION_TOKEN);
safeAssertString(process.env.AWS_REGION);
safeAssertString(process.env.AWS_ACCOUNT);
safeAssertString(process.env.AWS_USER);

// ---- CONFIG ----
const clusterName = 'unilogs-cluster';
const region = 'us-east-2';
const namespace = 'kafka';
const secretName = 'kafka-tls';
// const fieldName = 'ca.crt'; // or whatever field you need

// async function getKubernetesToken(clusterName: string): Promise<string> {
//   const credentials: AwsCredentialIdentity = {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
//     sessionToken: process.env.AWS_SESSION_TOKEN,
//     accountId: process.env.AWS_ACCOUNT,
//   };

//   // Build token manually (uses same signing method as aws-iam-authenticator)
//   const url = new URL(
//     'https://sts.amazonaws.com/?Action=GetCallerIdentity&Version=2011-06-15'
//   );
//   const signed = await (
//     await import('@smithy/signature-v4')
//   ).SignatureV4.prototype.sign({
//     credentials,
//     region: region,
//     service: 'sts',
//     method: 'GET',
//     protocol: 'https:',
//     hostname: url.hostname,
//     path: url.pathname + url.search,
//     headers: { host: url.hostname },
//   });

//   const token =
//     'k8s-aws-v1.' +
//     Buffer.from(signed.headers.Authorization)
//       .toString('base64')
//       .replace(/=+$/, '')
//       .replace(/\+/g, '-')
//       .replace(/\//g, '_');

//   return token;
// }

async function main() {
  const eks = new EKSClient({ region });

  // ---- Get cluster info (API server + CA) ----
  const clusterResp = await eks.send(
    new DescribeClusterCommand({ name: clusterName })
  );
  const cluster = clusterResp.cluster;
  if (!cluster || !cluster.endpoint || !cluster.certificateAuthority?.data) {
    throw new Error('Could not retrieve cluster info');
  }

  const apiServer = cluster.endpoint;
  // const caCert = Buffer.from(
  //   cluster.certificateAuthority.data,
  //   'base64'
  // ).toString('utf-8');
  // const token = await getKubernetesToken(clusterName);
  const token = "k8s-aws-v1.aHR0cHM6Ly9zdHMudXMtZWFzdC0yLmFtYXpvbmF3cy5jb20vP0FjdGlvbj1HZXRDYWxsZXJJZGVudGl0eSZWZXJzaW9uPTIwMTEtMDYtMTUmWC1BbXotQWxnb3JpdGhtPUFXUzQtSE1BQy1TSEEyNTYmWC1BbXotQ3JlZGVudGlhbD1BS0lBWlEzRFVaMkY2Rko3RzdFRiUyRjIwMjUwNDE0JTJGdXMtZWFzdC0yJTJGc3RzJTJGYXdzNF9yZXF1ZXN0JlgtQW16LURhdGU9MjAyNTA0MTRUMTgyMDU4WiZYLUFtei1FeHBpcmVzPTYwJlgtQW16LVNpZ25lZEhlYWRlcnM9aG9zdCUzQngtazhzLWF3cy1pZCZYLUFtei1TaWduYXR1cmU9NTM5MTEzNDUyMzM4M2U2MmFjYzE4MWIwZTZjN2QzNTYyOWFhZDMzZjY1NTYwODllY2FkYTdlYzk3MzNlMDU0Mg";

  // ---- Query the Kubernetes API for the Secret ----
  const secretUrl = `${apiServer}/api/v1/namespaces/${namespace}/secrets/${secretName}`;
  const res = await fetch(secretUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    // In production, verify with the CA cert properly
    agent: new (await import('https')).Agent({ rejectUnauthorized: false }),
  });

  if (!res.ok) {
    throw new Error(`Failed to get secret: ${res.status} ${res.statusText}`);
  }

  const json = await res.json() as {data: {'ca.cert': string}};
  if (typeof json !== 'object' || json === null) throw new Error('Unexpected json');
  const encodedCert = json.data['ca.cert'];
  const decodedCert = Buffer.from(encodedCert, 'base64');
console.log(encodedCert);
console.log(decodedCert);
  // ---- Write to file ----
  // const fs = await import('fs/promises');
  // await fs.writeFile(`./${fieldName.replace('.', '_')}`, decodedCert);
  // console.log(`✅ Saved cert to ./${fieldName.replace('.', '_')}`);
}

main().catch(console.error);
