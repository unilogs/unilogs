"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prompts_1 = __importDefault(require("prompts"));
const safeAssertString_1 = __importDefault(require("./safeAssertString"));
async function createAwsCredentialIdentity() {
    const { accessKeyId } = await (0, prompts_1.default)({
        type: 'text',
        name: 'accessKeyId',
        message: 'AWS access key ID',
        hint: 'required',
        validate: (input) => /^[A-Z0-9]+$/.test(input),
    });
    const { secretAccessKey } = await (0, prompts_1.default)({
        type: 'text',
        name: 'secretAccessKey',
        message: 'AWS secret access key',
        hint: 'required',
        validate: (input) => /^[\S]+$/.test(input),
    });
    const { sessionToken } = await (0, prompts_1.default)({
        type: 'text',
        name: 'sessionToken',
        message: 'AWS session token',
        validate: (input) => /^[\S]*$/.test(input),
    });
    const { accountId } = await (0, prompts_1.default)({
        type: 'text',
        name: 'accountId',
        message: 'AWS account ID',
        validate: (input) => /^[0-9]*$/.test(input),
    });
    (0, safeAssertString_1.default)(accessKeyId);
    (0, safeAssertString_1.default)(secretAccessKey);
    (0, safeAssertString_1.default)(sessionToken);
    (0, safeAssertString_1.default)(accountId);
    return {
        accessKeyId,
        secretAccessKey,
        sessionToken,
        accountId,
    };
}
exports.default = createAwsCredentialIdentity;
