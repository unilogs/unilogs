import createAwsCredentialIdentity from './utils/createAwsCredentialIdentity';
import {
  ElasticLoadBalancingV2Client,
  DescribeLoadBalancersCommand,
} from '@aws-sdk/client-elastic-load-balancing-v2';

async function main() {
  const credentials = await createAwsCredentialIdentity();

  const elbClient = new ElasticLoadBalancingV2Client({ credentials });
  const loadBalancersDescription = await elbClient.send(
    new DescribeLoadBalancersCommand()
  );
  console.log(JSON.stringify(loadBalancersDescription));
}

void main();
