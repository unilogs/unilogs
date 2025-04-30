import { AwsCredentialIdentity } from '@smithy/types';
import {
  ElasticLoadBalancingV2Client,
  DescribeLoadBalancersCommand,
  DescribeTagsCommand,
  LoadBalancer,
} from '@aws-sdk/client-elastic-load-balancing-v2';

async function getTags(
  elbClient: ElasticLoadBalancingV2Client,
  loadBalancers: LoadBalancer[]
) {
  const tags = await elbClient.send(
    new DescribeTagsCommand({
      ResourceArns: loadBalancers.map((lb) => lb.LoadBalancerArn ?? ''),
    })
  );
  return tags;
}

async function getLoadBalancers(elbClient: ElasticLoadBalancingV2Client) {
  const loadBalancersDescription = await elbClient.send(
    new DescribeLoadBalancersCommand()
  );
  const loadBalancers: LoadBalancer[] =
    loadBalancersDescription.LoadBalancers ?? [];
  return loadBalancers;
}

async function consoleLogLbUrls(credentials: AwsCredentialIdentity) {
  const elbClient = new ElasticLoadBalancingV2Client({ credentials });
  const lbs = await getLoadBalancers(elbClient);
  const tags = await getTags(elbClient, lbs);
  const kafkaArns =
    tags.TagDescriptions?.filter(
      (td) =>
        (
          td.Tags?.filter(
            (tg) =>
              tg.Key === 'kubernetes.io/service-name' &&
              /^kafka\/kafka-controller/.test(tg.Value ?? '')
          ) ?? []
        ).length > 0
    ).map((td) => td.ResourceArn ?? '') ?? [];
  const grafanaArns =
    tags.TagDescriptions?.filter(
      (td) =>
        (
          td.Tags?.filter(
            (tg) =>
              tg.Key === 'kubernetes.io/service-name' &&
              /^grafana\/unilogscdkstackeksclusterchartgrafana/.test(
                tg.Value ?? ''
              )
          ) ?? []
        ).length > 0
    ).map((td) => td.ResourceArn ?? '') ?? [];
  console.log('Grafana URL:');
  console.log(
    lbs
      .filter((lb) => grafanaArns.includes(lb.LoadBalancerArn ?? ''))
      .map((lb) => lb.DNSName)
      .join(',')
  );
  console.log();
  console.log('Kafka Bootstrap servers:');
  console.log(
    lbs
      .filter((lb) => kafkaArns.includes(lb.LoadBalancerArn ?? ''))
      .map((lb) => `${lb.DNSName}:9095`)
      .join(',')
  );
  console.log();
}

export default consoleLogLbUrls;
