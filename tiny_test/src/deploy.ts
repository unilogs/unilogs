import {
  EC2Client,
  CreateVpcCommand,
  ModifyVpcAttributeCommand,
  CreateInternetGatewayCommand,
  AttachInternetGatewayCommand,
  CreateSubnetCommand,
  CreateRouteTableCommand,
  CreateRouteCommand,
  AssociateRouteTableCommand,
} from "@aws-sdk/client-ec2";

import {
  EKSClient,
  CreateClusterCommand,
  CreateFargateProfileCommand,
} from "@aws-sdk/client-eks";

import {
  IAMClient,
  CreateRoleCommand,
  AttachRolePolicyCommand,
} from "@aws-sdk/client-iam";

const REGION = "us-east-2";
const ec2Client = new EC2Client({ region: REGION });
const eksClient = new EKSClient({ region: REGION });
const iamClient = new IAMClient({ region: REGION });

const createVPC = async () => {
  const response = await ec2Client.send(
    new CreateVpcCommand({ CidrBlock: "10.0.0.0/16" })
  );
  const vpcId = response.Vpc?.VpcId;
  console.log(`✅ Created VPC: ${vpcId}`);

  await ec2Client.send(new ModifyVpcAttributeCommand({ VpcId: vpcId!, EnableDnsSupport: { Value: true } }));
  await ec2Client.send(new ModifyVpcAttributeCommand({ VpcId: vpcId!, EnableDnsHostnames: { Value: true } }));

  return vpcId!;
};

const createInternetGateway = async (vpcId: string) => {
  const response = await ec2Client.send(new CreateInternetGatewayCommand({}));
  const igwId = response.InternetGateway?.InternetGatewayId!;
  console.log(`✅ Created Internet Gateway: ${igwId}`);

  await ec2Client.send(new AttachInternetGatewayCommand({ InternetGatewayId: igwId, VpcId: vpcId }));
  return igwId;
};

const createSubnet = async (vpcId: string, cidrBlock: string, az: string, name: string) => {
  const response = await ec2Client.send(new CreateSubnetCommand({ VpcId: vpcId, CidrBlock: cidrBlock, AvailabilityZone: az }));
  console.log(`✅ Created Subnet (${name}): ${response.Subnet?.SubnetId}`);
  return response.Subnet?.SubnetId!;
};

const createRouteTable = async (vpcId: string, igwId: string, subnetId: string) => {
  const response = await ec2Client.send(new CreateRouteTableCommand({ VpcId: vpcId }));
  const routeTableId = response.RouteTable?.RouteTableId!;
  console.log(`✅ Created Route Table: ${routeTableId}`);

  await ec2Client.send(new CreateRouteCommand({ RouteTableId: routeTableId, DestinationCidrBlock: "0.0.0.0/0", GatewayId: igwId }));
  await ec2Client.send(new AssociateRouteTableCommand({ RouteTableId: routeTableId, SubnetId: subnetId }));
  console.log(`✅ Associated Route Table with Subnet: ${subnetId}`);
};

const createIAMRole = async (roleName: string, assumeRolePolicy: any, policyArn: string) => {
  const response = await iamClient.send(new CreateRoleCommand({ RoleName: roleName, AssumeRolePolicyDocument: JSON.stringify(assumeRolePolicy) }));
  const roleArn = response.Role?.Arn!;
  console.log(`✅ Created IAM Role: ${roleArn}`);

  await iamClient.send(new AttachRolePolicyCommand({ RoleName: roleName, PolicyArn: policyArn }));
  return roleArn;
};

const waitForClusterActive = async (clusterName: string) => {
  console.log(`⏳ Waiting for EKS cluster "${clusterName}" to become ACTIVE...`);
  while (true) {
    const response = await eksClient.send(new DescribeClusterCommand({ name: clusterName }));
    const status = response.cluster?.status;
    console.log(`🔄 Cluster Status: ${status}`);
    
    if (status === "ACTIVE") {
      console.log(`✅ Cluster "${clusterName}" is now ACTIVE.`);
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds before retrying
  }
};

const createEKSCluster = async (roleArn: string, subnets: string[]) => {
  const response = await eksClient.send(new CreateClusterCommand({
    name: "my-fargate-cluster",
    roleArn,
    resourcesVpcConfig: { subnetIds: subnets, endpointPublicAccess: true },
    version: "1.32",
  }));
  console.log(`✅ Creating EKS cluster: ${response.cluster?.name}`);

  await waitForClusterActive(response.cluster?.name!); // Wait for the cluster to be ACTIVE
  return response.cluster?.name!;
};



const createFargateProfile = async (clusterName: string, fargateRoleArn: string, subnets: string[]) => {
  const response = await eksClient.send(new CreateFargateProfileCommand({
    clusterName,
    fargateProfileName: "default",
    podExecutionRoleArn: fargateRoleArn,
    selectors: [{ namespace: "default" }],
    subnets,
  }));
  console.log(`✅ Created Fargate Profile: ${response.fargateProfile?.fargateProfileName}`);
};

const deploy = async () => {
  try {
    const vpcId = await createVPC();
    const igwId = await createInternetGateway(vpcId);
    const subnet1 = await createSubnet(vpcId, "10.0.1.0/24", `${REGION}a`, "PublicSubnet1");
    const subnet2 = await createSubnet(vpcId, "10.0.2.0/24", `${REGION}b`, "PublicSubnet2");

    await createRouteTable(vpcId, igwId, subnet1);
    await createRouteTable(vpcId, igwId, subnet2);

    const eksRoleArn = await createIAMRole("EKSClusterRole", {
      Version: "2012-10-17",
      Statement: [{ Effect: "Allow", Principal: { Service: "eks.amazonaws.com" }, Action: "sts:AssumeRole" }],
    }, "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy");

    const clusterName = await createEKSCluster(eksRoleArn, [subnet1, subnet2]);

    const fargateRoleArn = await createIAMRole("EKSFargateExecutionRole", {
      Version: "2012-10-17",
      Statement: [{ Effect: "Allow", Principal: { Service: "eks-fargate-pods.amazonaws.com" }, Action: "sts:AssumeRole" }],
    }, "arn:aws:iam::aws:policy/AmazonEKSFargatePodExecutionRolePolicy");

    await createFargateProfile(clusterName, fargateRoleArn, [subnet1, subnet2]);
  } catch (error) {
    console.error("❌ Deployment Failed:", error);
  }
};

deploy();
