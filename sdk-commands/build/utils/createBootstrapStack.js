"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
function createBootstrapStack() {
    return __awaiter(this, void 0, void 0, function* () {
        const bootstrapTemplate = (0, fs_1.readFileSync)('./bootstrap-template.yaml', 'utf8');
        const credentials = yield (0, createAwsCredentialIdentity_1.default)();
        const { region } = yield (0, prompts_1.default)({
            type: 'text',
            name: 'region',
            message: 'region',
        });
        (0, safeAssertString_1.default)(region);
        const cloudFormationClient = (0, createCloudFormationClient_1.default)({
            region,
            credentials,
        });
        yield cloudFormationClient.send(new client_cloudformation_1.CreateStackCommand({
            StackName: 'CDKToolkit',
            TemplateBody: bootstrapTemplate,
            Capabilities: ['CAPABILITY_NAMED_IAM'],
        }));
    });
}
void createBootstrapStack();
