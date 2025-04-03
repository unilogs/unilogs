import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as eks from 'aws-cdk-lib/aws-eks';
import { KubectlV32Layer as KubectlLayer } from '@aws-cdk/lambda-layer-kubectl-v32';

export class UnilogsCdkStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ==================== MINIMAL VPC ====================
    const vpc = new ec2.Vpc(this, 'TestVpc', {
      maxAzs: 2,
      natGateways: 1,
    });

    // ==================== EKS CLUSTER ====================
    const cluster = new eks.FargateCluster(this, 'TestCluster', {
      vpc,
      version: eks.KubernetesVersion.V1_32,
      kubectlLayer: new KubectlLayer(this, 'kubectl'),
      clusterName: 'vector-test-cluster',
    });

    // ==================== VECTOR TEST CONFIG ====================
    const vectorChart = cluster.addHelmChart('VectorTest', {
      chart: 'vector',
      repository: 'https://helm.vector.dev',
      namespace: 'vector',
      createNamespace: true,
      values: {
        role: 'Agent',
        customConfig: {
          sources: {
            test_logs: {
              type: "demo_logs",
              format: "shuffle",
              lines: [
                "2023-01-01T12:00:00Z INFO Test message 1",
                "2023-01-01T12:00:01Z ERROR Test message 2",
                "2023-01-01T12:00:02Z DEBUG Test message 3"
              ],
              interval: 1
            }
          },
          sinks: {
            console: {
              type: "console",
              inputs: ["test_logs"],
              encoding: {
                codec: "json"
              }
            }
          }
        },
        service: {
          enabled: true,
          type: "ClusterIP",
          ports: [
            {
              name: "vector",
              port: 8686,
              targetPort: 8686,
              protocol: "TCP"
            }
          ]
        }
      }
    });

    // ==================== OUTPUTS ====================
    new cdk.CfnOutput(this, 'ClusterName', { value: cluster.clusterName });
    new cdk.CfnOutput(this, 'VectorTestCommand', {
      value: 'kubectl logs -n vector -l app.kubernetes.io/instance=vector'
    });
  }
}