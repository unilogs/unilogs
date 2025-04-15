"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_cloudformation_1 = require("@aws-sdk/client-cloudformation");
async function getStackResourcesList(props) {
    const resourcesList = await props.cloudFormationClient.send(new client_cloudformation_1.ListStackResourcesCommand({
        StackName: props.stackName,
    }));
    return resourcesList;
}
exports.default = getStackResourcesList;
