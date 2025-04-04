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
const prompts_1 = __importDefault(require("prompts"));
const safeAssertString_1 = __importDefault(require("./utils/safeAssertString"));
const createAwsCredentialIdentity_1 = __importDefault(require("./createAwsCredentialIdentity"));
function createCloudFormationClient() {
    return __awaiter(this, void 0, void 0, function* () {
        const { region } = yield (0, prompts_1.default)({
            type: 'text',
            name: 'region',
            message: 'region',
            hint: 'required',
            validate: (input) => /^[a-z0-9-]+$/.test(input),
        });
        (0, safeAssertString_1.default)(region);
        const credentials = yield (0, createAwsCredentialIdentity_1.default)();
        const config = { region, credentials };
        return new client_cloudformation_1.CloudFormationClient(config);
    });
}
exports.default = createCloudFormationClient;
