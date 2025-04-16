import dotenv from 'dotenv';
dotenv.config();
import EKSToken from 'aws-eks-token';

async function main() {
  const token = await EKSToken.renew('unilogs-cluster');
  console.log(token);
}
void main();

// export async function getEksToken(clusterName: string, region: string): Promise<string> {
//   const credentials = await defaultProvider()();

//   const signer = new SignatureV4({
//     credentials,
//     service: 'sts',
//     region,
//     sha256: Sha256,
//   });

//   // Build the URL for GetCallerIdentity
//   const url = new URL('https://sts.amazonaws.com');
//   url.searchParams.append('Action', 'GetCallerIdentity');
//   url.searchParams.append('Version', '2011-06-15');

//   // Include the cluster name as a header (or you could also embed it as a query param)
//   const signed = await signer.presign({
//     method: 'GET',
//     protocol: url.protocol,  // "https:"
//     hostname: url.hostname,  // "sts.amazonaws.com"
//     path: url.pathname,      // typically "/"
//     query: Object.fromEntries(url.searchParams.entries()),
//     headers: {
//       host: url.hostname,
//       'x-k8s-aws-id': clusterName,
//     },
//   });

//   // Reconstruct the presigned URL string manually.
//   const queryString = new URLSearchParams(signed.query as Record<string, string>).toString();
//   const presignedUrl = `${signed.protocol}//${signed.hostname}${signed.path}?${queryString}`;

//   // The token is the base64url encoding of this presigned URL with a "k8s-aws-v1." prefix.
//   const token = 'k8s-aws-v1.' + Buffer.from(presignedUrl).toString('base64url');
//   console.log(token);
//   return token;
// }

// void getEksToken('unilogs-cluster', 'us-east-2');
