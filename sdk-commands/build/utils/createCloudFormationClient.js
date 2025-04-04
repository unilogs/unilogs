"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_cloudformation_1 = require("@aws-sdk/client-cloudformation");
function createCloudFormationClient(props) {
    const config = { region: props.region, credentials: props.credentials };
    return new client_cloudformation_1.CloudFormationClient(config);
}
exports.default = createCloudFormationClient;
