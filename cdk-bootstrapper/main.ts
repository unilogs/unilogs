import createCloudFormationClient from "./createCloudFormationClient";

async function main() {
  const cloudFormationClient = await createCloudFormationClient();
  console.log(cloudFormationClient);
}

void main();