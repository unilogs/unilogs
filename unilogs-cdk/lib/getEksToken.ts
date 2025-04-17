// This is based on an oudated npm package `aws-eks-token`
// Altered to remove dependency on the old aws-sdk.

import crypto from 'crypto-js';
const { SHA256, HmacSHA256 } = crypto;
const { Hex, Base64, Utf8 } = crypto.enc;
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
import { AwsCredentialIdentity } from '@smithy/types';

class EKSTokenGenerator {
  private credentials;
  private clusterName;
  private region;

  constructor(
    credentials: AwsCredentialIdentity,
    clusterName: string,
    region: string
  ) {
    this.credentials = credentials;
    this.clusterName = clusterName;
    this.region = region;
  }

  generate(expires = '60') {
    if (
      !this.credentials.accessKeyId ||
      !this.credentials.secretAccessKey ||
      !this.region
    ) {
      throw new Error('Lose the accessKeyId, secretAccessKey or region');
    }
    // YYYYMMDD'T'HHMMSS'Z'
    const fullDate = dayjs.utc().format('YYYYMMDDTHHmmss[Z]');
    const subDate = fullDate.substring(0, 8);
    const tokenHeader = this.credentials.sessionToken
      ? `X-Amz-Security-Token=${encodeURIComponent(
          this.credentials.sessionToken
        )}&`
      : '';
    const canonicalRequest =
      'GET' +
      '\n' +
      '/' +
      '\n' +
      'Action=GetCallerIdentity&' +
      'Version=2011-06-15&' +
      'X-Amz-Algorithm=AWS4-HMAC-SHA256&' +
      `X-Amz-Credential=${this.credentials.accessKeyId}%2F${subDate}%2F${this.region}%2Fsts%2Faws4_request&` +
      `X-Amz-Date=${fullDate}&` +
      `X-Amz-Expires=${expires}&` +
      tokenHeader +
      `X-Amz-SignedHeaders=host%3Bx-k8s-aws-id` +
      '\n' +
      `host:sts.${this.region}.amazonaws.com\nx-k8s-aws-id:${this.clusterName}\n` +
      '\n' +
      'host;x-k8s-aws-id' +
      '\n' +
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    const hashedCanonicalRequest = Hex.stringify(SHA256(canonicalRequest));
    const stringToSign =
      'AWS4-HMAC-SHA256' +
      '\n' +
      fullDate +
      '\n' +
      `${subDate}/${this.region}/sts/aws4_request` +
      '\n' +
      hashedCanonicalRequest;
    const signingKey = ((key, dateStamp, regionName, serviceName) => {
      const kDate = HmacSHA256(dateStamp, 'AWS4' + key);
      const kRegion = HmacSHA256(regionName, kDate);
      const kService = HmacSHA256(serviceName, kRegion);
      const kSigning = HmacSHA256('aws4_request', kService);
      return kSigning;
    })(this.credentials.secretAccessKey, subDate, this.region, 'sts');
    const signature = Hex.stringify(HmacSHA256(stringToSign, signingKey));
    const presignedURL =
      `https://sts.${this.region}.amazonaws.com/?` +
      'Action=GetCallerIdentity&' +
      'Version=2011-06-15&' +
      'X-Amz-Algorithm=AWS4-HMAC-SHA256&' +
      `X-Amz-Credential=${this.credentials.accessKeyId}%2F${subDate}%2F${this.region}%2Fsts%2Faws4_request&` +
      `X-Amz-Date=${fullDate}&` +
      `X-Amz-Expires=${expires}&` +
      tokenHeader +
      'X-Amz-SignedHeaders=host%3Bx-k8s-aws-id&' +
      `X-Amz-Signature=${signature}`;
    const base64Encoding = Base64.stringify(Utf8.parse(presignedURL))
      // for url safe
      .replace(/\+/g, '-') // Convert '+' to '-'
      .replace(/\//g, '_') // Convert '/' to '_'
      .replace(/=+$/, ''); // Remove ending '='
    const eksToken = 'k8s-aws-v1.' + base64Encoding;
    return eksToken;
  }
}

export default EKSTokenGenerator;
