"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_cloudformation_1 = require("@aws-sdk/client-cloudformation");
const createCloudFormationClient_1 = __importDefault(require("./createCloudFormationClient"));
const fs_1 = require("fs");
const createAwsCredentialIdentity_1 = __importDefault(require("./createAwsCredentialIdentity"));
const prompts_1 = __importDefault(require("prompts"));
const safeAssertString_1 = __importDefault(require("./safeAssertString"));
async function createBootstrapStack() {
    const bootstrapTemplate = (0, fs_1.readFileSync)('./bootstrap-template.yaml', 'utf8');
    const credentials = await (0, createAwsCredentialIdentity_1.default)();
    const { region } = await (0, prompts_1.default)({
        type: 'text',
        name: 'region',
        message: 'region',
    });
    (0, safeAssertString_1.default)(region);
    const cloudFormationClient = (0, createCloudFormationClient_1.default)({
        region,
        credentials,
    });
    await cloudFormationClient.send(new client_cloudformation_1.CreateStackCommand({
        StackName: 'CDKToolkit',
        TemplateBody: bootstrapTemplate,
        Capabilities: ['CAPABILITY_NAMED_IAM'],
    }));
}
void createBootstrapStack();
