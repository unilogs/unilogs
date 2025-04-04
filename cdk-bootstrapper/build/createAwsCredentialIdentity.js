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
const safeAssertString_1 = __importDefault(require("./utils/safeAssertString"));
function createAwsCredentialIdentity() {
    return __awaiter(this, void 0, void 0, function* () {
        const { accessKeyId } = yield (0, prompts_1.default)({
            type: 'text',
            name: 'accessKeyId',
            message: 'AWS access key ID',
            hint: 'required',
            validate: (input) => /^[A-Z0-9]+$/.test(input),
        });
        const { secretAccessKey } = yield (0, prompts_1.default)({
            type: 'text',
            name: 'secretAccessKey',
            message: 'AWS secret access key',
            hint: 'required',
            validate: (input) => /^[\S]+$/.test(input),
        });
        const { sessionToken } = yield (0, prompts_1.default)({
            type: 'text',
            name: 'sessionToken',
            message: 'AWS session token',
            validate: (input) => /^[\S]*$/.test(input),
        });
        const { accountId } = yield (0, prompts_1.default)({
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
    });
}
exports.default = createAwsCredentialIdentity;
