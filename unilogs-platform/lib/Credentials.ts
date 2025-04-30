import { AwsCredentialIdentity } from '@smithy/types';

class Credentials implements AwsCredentialIdentity {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  accountId?: string;

  constructor(accessKeyId: string, secretAccessKey: string, sessionToken?: string, accountId?: string) {
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.sessionToken = sessionToken;
    this.accountId = accountId;
  }
}

export default Credentials;