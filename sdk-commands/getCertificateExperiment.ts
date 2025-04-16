import * as dotenv from 'dotenv';
import { EKSClient, DescribeClusterCommand } from '@aws-sdk/client-eks';
import { AwsCredentialIdentity } from '@smithy/types';
import safeAssertString from './utils/safeAssertString';

// import fetch from "node-fetch";
// import { Buffer } from "buffer";
// import createAwsCredentialIdentity from "./utils/createAwsCredentialIdentity";

dotenv.config();
safeAssertString(process.env.AWS_ACCESS_KEY_ID);
safeAssertString(process.env.AWS_SECRET_ACCESS_KEY);
safeAssertString(process.env.AWS_SESSION_TOKEN);
safeAssertString(process.env.AWS_REGION);
safeAssertString(process.env.AWS_ACCOUNT);
safeAssertString(process.env.AWS_USER);

// ---- CONFIG ----
const clusterName = 'unilogs-cluster';
// const namespace = 'kafka';
// const secretName = 'kafka-tls';
// const fieldName = 'ca.crt'; // or whatever field you need

const credentials: AwsCredentialIdentity = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  sessionToken: process.env.AWS_SESSION_TOKEN,
  accountId: process.env.AWS_ACCOUNT,
};

async function main() {
  const eksClient = new EKSClient({ credentials });
  const clusterData = await eksClient.send(
    new DescribeClusterCommand({ name: clusterName })
  );
  console.log(JSON.stringify(clusterData));
  const token =
    'k8s-aws-v1.' +
    Buffer.from(clusterData.cluster?.certificateAuthority?.data ?? '')
      .toString('base64')
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  console.log(token);
}
void main();
// async function getKubernetesToken(clusterName: string): Promise<string> {

//   const creds = await createAwsCredentialIdentity();

//   // Build token manually (uses same signing method as aws-iam-authenticator)
//   const url = new URL("https://sts.amazonaws.com/?Action=GetCallerIdentity&Version=2011-06-15");
//   const signed = await (await import("@aws-sdk/signature-v4")).SignatureV4.prototype.sign({
//     credentials: creds,
//     region: region,
//     service: "sts",
//     method: "GET",
//     protocol: "https:",
//     hostname: url.hostname,
//     path: url.pathname + url.search,
//     headers: { host: url.hostname },
//   });

//   const token = "k8s-aws-v1." + Buffer.from(signed.headers.Authorization).toString("base64")
//     .replace(/=+$/, "")
//     .replace(/\+/g, "-")
//     .replace(/\//g, "_");

//   return token;
// }

// async function main() {
//   const eks = new EKSClient({ region });

//   // ---- Get cluster info (API server + CA) ----
//   const clusterResp = await eks.send(new DescribeClusterCommand({ name: clusterName }));
//   const cluster = clusterResp.cluster;
//   if (!cluster || !cluster.endpoint || !cluster.certificateAuthority?.data) {
//     throw new Error("Could not retrieve cluster info");
//   }

//   const apiServer = cluster.endpoint;
//   const caCert = Buffer.from(cluster.certificateAuthority.data, "base64").toString("utf-8");
//   const token = await getKubernetesToken(clusterName);

// ---- Query the Kubernetes API for the Secret ----

//   const apiServer = '';
//   const token = '';

//   const secretUrl = `${apiServer}/api/v1/namespaces/${namespace}/secrets/${secretName}`;
//   const res = await fetch(secretUrl, {
//     method: "GET",
//     headers: {
//       Authorization: `Bearer ${token}`,
//     },
//     // In production, verify with the CA cert properly
//     agent: new (await import("https")).Agent({ rejectUnauthorized: false })
//   });

//   if (!res.ok) {
//     throw new Error(`Failed to get secret: ${res.status} ${res.statusText}`);
//   }

//   const json = await res.json();
//   const encodedCert = json.data[fieldName];
//   const decodedCert = Buffer.from(encodedCert, "base64");

//   // ---- Write to file ----
//   const fs = await import("fs/promises");
//   await fs.writeFile(`./${fieldName.replace(".", "_")}`, decodedCert);
//   console.log(`✅ Saved cert to ./${fieldName.replace(".", "_")}`);
// }

// main().catch(console.error);
