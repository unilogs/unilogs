import { AwsCredentialIdentity } from '@smithy/types';
import {
  ElasticLoadBalancingV2Client,
  DescribeLoadBalancersCommand,
  DescribeTagsCommand,
  LoadBalancer
} from '@aws-sdk/client-elastic-load-balancing-v2';

async function getTags(elbClient: ElasticLoadBalancingV2Client, loadBalancer: LoadBalancer) {
  const tags = await elbClient.send(new DescribeTagsCommand({ResourceArns: [loadBalancer.LoadBalancerArn ?? '']}));
  console.log(loadBalancer.LoadBalancerArn);
  console.log(loadBalancer.DNSName);
  console.log(JSON.stringify(tags.TagDescriptions));
  console.log();
}

export async function getLoadBalancerUrls(credentials: AwsCredentialIdentity) {

  const elbClient = new ElasticLoadBalancingV2Client({ credentials });
  const loadBalancersDescription = await elbClient.send(
    new DescribeLoadBalancersCommand()
  );
  const loadBalancers: LoadBalancer[] = loadBalancersDescription.LoadBalancers ?? [];
  for (const lb of loadBalancers) {
    void getTags(elbClient, lb);
  }
}

