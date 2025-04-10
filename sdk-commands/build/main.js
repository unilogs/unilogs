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
const prompts_1 = __importDefault(require("prompts"));
const createAwsCredentialIdentity_1 = __importDefault(require("./utils/createAwsCredentialIdentity"));
const createCloudFormationClient_1 = __importDefault(require("./utils/createCloudFormationClient"));
const safeAssertString_1 = __importDefault(require("./utils/safeAssertString"));
const getStackResourceList_1 = __importDefault(require("./utils/getStackResourceList"));
const getKafkaBrokers_1 = __importDefault(require("./utils/getKafkaBrokers"));
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const credentials = yield (0, createAwsCredentialIdentity_1.default)();
        const { region } = yield (0, prompts_1.default)({
            type: 'text',
            name: 'region',
            message: 'region',
        });
        (0, safeAssertString_1.default)(region);
        const { stackName } = yield (0, prompts_1.default)({
            type: 'text',
            name: 'stackName',
            message: 'StackName',
            initial: 'UnilogsCdkStack',
        });
        (0, safeAssertString_1.default)(stackName);
        const cloudFormationClient = (0, createCloudFormationClient_1.default)({
            region,
            credentials,
        });
        const stackResourcesList = yield (0, getStackResourceList_1.default)({
            stackName,
            cloudFormationClient,
        });
        const kafkaArn = (_b = (_a = stackResourcesList.StackResourceSummaries) === null || _a === void 0 ? void 0 : _a.filter((resourceSummary) => resourceSummary.ResourceType === 'AWS::MSK::Cluster')[0].PhysicalResourceId) !== null && _b !== void 0 ? _b : '';
        const kafkaBootstrapBrokers = yield (0, getKafkaBrokers_1.default)({ kafkaArn, region, credentials });
        console.log(kafkaBootstrapBrokers);
    });
}
void main();
