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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_ec2_1 = require("@aws-sdk/client-ec2");
var client_eks_1 = require("@aws-sdk/client-eks");
var client_iam_1 = require("@aws-sdk/client-iam");
var REGION = "us-east-2";
var ec2Client = new client_ec2_1.EC2Client({ region: REGION });
var eksClient = new client_eks_1.EKSClient({ region: REGION });
var iamClient = new client_iam_1.IAMClient({ region: REGION });
var createVPC = function () { return __awaiter(void 0, void 0, void 0, function () {
    var response, vpcId;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, ec2Client.send(new client_ec2_1.CreateVpcCommand({ CidrBlock: "10.0.0.0/16" }))];
            case 1:
                response = _b.sent();
                vpcId = (_a = response.Vpc) === null || _a === void 0 ? void 0 : _a.VpcId;
                console.log("\u2705 Created VPC: ".concat(vpcId));
                return [4 /*yield*/, ec2Client.send(new client_ec2_1.ModifyVpcAttributeCommand({ VpcId: vpcId, EnableDnsSupport: { Value: true } }))];
            case 2:
                _b.sent();
                return [4 /*yield*/, ec2Client.send(new client_ec2_1.ModifyVpcAttributeCommand({ VpcId: vpcId, EnableDnsHostnames: { Value: true } }))];
            case 3:
                _b.sent();
                return [2 /*return*/, vpcId];
        }
    });
}); };
var createInternetGateway = function (vpcId) { return __awaiter(void 0, void 0, void 0, function () {
    var response, igwId;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, ec2Client.send(new client_ec2_1.CreateInternetGatewayCommand({}))];
            case 1:
                response = _b.sent();
                igwId = (_a = response.InternetGateway) === null || _a === void 0 ? void 0 : _a.InternetGatewayId;
                console.log("\u2705 Created Internet Gateway: ".concat(igwId));
                return [4 /*yield*/, ec2Client.send(new client_ec2_1.AttachInternetGatewayCommand({ InternetGatewayId: igwId, VpcId: vpcId }))];
            case 2:
                _b.sent();
                return [2 /*return*/, igwId];
        }
    });
}); };
var createSubnet = function (vpcId, cidrBlock, az, name) { return __awaiter(void 0, void 0, void 0, function () {
    var response;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0: return [4 /*yield*/, ec2Client.send(new client_ec2_1.CreateSubnetCommand({ VpcId: vpcId, CidrBlock: cidrBlock, AvailabilityZone: az }))];
            case 1:
                response = _c.sent();
                console.log("\u2705 Created Subnet (".concat(name, "): ").concat((_a = response.Subnet) === null || _a === void 0 ? void 0 : _a.SubnetId));
                return [2 /*return*/, (_b = response.Subnet) === null || _b === void 0 ? void 0 : _b.SubnetId];
        }
    });
}); };
var createRouteTable = function (vpcId, igwId, subnetId) { return __awaiter(void 0, void 0, void 0, function () {
    var response, routeTableId;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, ec2Client.send(new client_ec2_1.CreateRouteTableCommand({ VpcId: vpcId }))];
            case 1:
                response = _b.sent();
                routeTableId = (_a = response.RouteTable) === null || _a === void 0 ? void 0 : _a.RouteTableId;
                console.log("\u2705 Created Route Table: ".concat(routeTableId));
                return [4 /*yield*/, ec2Client.send(new client_ec2_1.CreateRouteCommand({ RouteTableId: routeTableId, DestinationCidrBlock: "0.0.0.0/0", GatewayId: igwId }))];
            case 2:
                _b.sent();
                return [4 /*yield*/, ec2Client.send(new client_ec2_1.AssociateRouteTableCommand({ RouteTableId: routeTableId, SubnetId: subnetId }))];
            case 3:
                _b.sent();
                console.log("\u2705 Associated Route Table with Subnet: ".concat(subnetId));
                return [2 /*return*/];
        }
    });
}); };
var createIAMRole = function (roleName, assumeRolePolicy, policyArn) { return __awaiter(void 0, void 0, void 0, function () {
    var response, roleArn;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, iamClient.send(new client_iam_1.CreateRoleCommand({ RoleName: roleName, AssumeRolePolicyDocument: JSON.stringify(assumeRolePolicy) }))];
            case 1:
                response = _b.sent();
                roleArn = (_a = response.Role) === null || _a === void 0 ? void 0 : _a.Arn;
                console.log("\u2705 Created IAM Role: ".concat(roleArn));
                return [4 /*yield*/, iamClient.send(new client_iam_1.AttachRolePolicyCommand({ RoleName: roleName, PolicyArn: policyArn }))];
            case 2:
                _b.sent();
                return [2 /*return*/, roleArn];
        }
    });
}); };
var waitForClusterActive = function (clusterName) { return __awaiter(void 0, void 0, void 0, function () {
    var response, status;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                console.log("\u23F3 Waiting for EKS cluster \"".concat(clusterName, "\" to become ACTIVE..."));
                _b.label = 1;
            case 1:
                if (!true) return [3 /*break*/, 4];
                return [4 /*yield*/, eksClient.send(new DescribeClusterCommand({ name: clusterName }))];
            case 2:
                response = _b.sent();
                status = (_a = response.cluster) === null || _a === void 0 ? void 0 : _a.status;
                console.log("\uD83D\uDD04 Cluster Status: ".concat(status));
                if (status === "ACTIVE") {
                    console.log("\u2705 Cluster \"".concat(clusterName, "\" is now ACTIVE."));
                    return [2 /*return*/];
                }
                return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 10000); })];
            case 3:
                _b.sent(); // Wait 10 seconds before retrying
                return [3 /*break*/, 1];
            case 4: return [2 /*return*/];
        }
    });
}); };
var createEKSCluster = function (roleArn, subnets) { return __awaiter(void 0, void 0, void 0, function () {
    var response;
    var _a, _b, _c;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0: return [4 /*yield*/, eksClient.send(new client_eks_1.CreateClusterCommand({
                    name: "my-fargate-cluster",
                    roleArn: roleArn,
                    resourcesVpcConfig: { subnetIds: subnets, endpointPublicAccess: true },
                    version: "1.32",
                }))];
            case 1:
                response = _d.sent();
                console.log("\u2705 Creating EKS cluster: ".concat((_a = response.cluster) === null || _a === void 0 ? void 0 : _a.name));
                return [4 /*yield*/, waitForClusterActive((_b = response.cluster) === null || _b === void 0 ? void 0 : _b.name)];
            case 2:
                _d.sent(); // Wait for the cluster to be ACTIVE
                return [2 /*return*/, (_c = response.cluster) === null || _c === void 0 ? void 0 : _c.name];
        }
    });
}); };
var createFargateProfile = function (clusterName, fargateRoleArn, subnets) { return __awaiter(void 0, void 0, void 0, function () {
    var response;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0: return [4 /*yield*/, eksClient.send(new client_eks_1.CreateFargateProfileCommand({
                    clusterName: clusterName,
                    fargateProfileName: "default",
                    podExecutionRoleArn: fargateRoleArn,
                    selectors: [{ namespace: "default" }],
                    subnets: subnets,
                }))];
            case 1:
                response = _b.sent();
                console.log("\u2705 Created Fargate Profile: ".concat((_a = response.fargateProfile) === null || _a === void 0 ? void 0 : _a.fargateProfileName));
                return [2 /*return*/];
        }
    });
}); };
var deploy = function () { return __awaiter(void 0, void 0, void 0, function () {
    var vpcId, igwId, subnet1, subnet2, eksRoleArn, clusterName, fargateRoleArn, error_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 11, , 12]);
                return [4 /*yield*/, createVPC()];
            case 1:
                vpcId = _a.sent();
                return [4 /*yield*/, createInternetGateway(vpcId)];
            case 2:
                igwId = _a.sent();
                return [4 /*yield*/, createSubnet(vpcId, "10.0.1.0/24", "".concat(REGION, "a"), "PublicSubnet1")];
            case 3:
                subnet1 = _a.sent();
                return [4 /*yield*/, createSubnet(vpcId, "10.0.2.0/24", "".concat(REGION, "b"), "PublicSubnet2")];
            case 4:
                subnet2 = _a.sent();
                return [4 /*yield*/, createRouteTable(vpcId, igwId, subnet1)];
            case 5:
                _a.sent();
                return [4 /*yield*/, createRouteTable(vpcId, igwId, subnet2)];
            case 6:
                _a.sent();
                return [4 /*yield*/, createIAMRole("EKSClusterRole", {
                        Version: "2012-10-17",
                        Statement: [{ Effect: "Allow", Principal: { Service: "eks.amazonaws.com" }, Action: "sts:AssumeRole" }],
                    }, "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy")];
            case 7:
                eksRoleArn = _a.sent();
                return [4 /*yield*/, createEKSCluster(eksRoleArn, [subnet1, subnet2])];
            case 8:
                clusterName = _a.sent();
                return [4 /*yield*/, createIAMRole("EKSFargateExecutionRole", {
                        Version: "2012-10-17",
                        Statement: [{ Effect: "Allow", Principal: { Service: "eks-fargate-pods.amazonaws.com" }, Action: "sts:AssumeRole" }],
                    }, "arn:aws:iam::aws:policy/AmazonEKSFargatePodExecutionRolePolicy")];
            case 9:
                fargateRoleArn = _a.sent();
                return [4 /*yield*/, createFargateProfile(clusterName, fargateRoleArn, [subnet1, subnet2])];
            case 10:
                _a.sent();
                return [3 /*break*/, 12];
            case 11:
                error_1 = _a.sent();
                console.error("❌ Deployment Failed:", error_1);
                return [3 /*break*/, 12];
            case 12: return [2 /*return*/];
        }
    });
}); };
deploy();
