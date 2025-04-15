"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const createKafkaClient_1 = __importDefault(require("./createKafkaClient"));
const client_kafka_1 = require("@aws-sdk/client-kafka");
async function getKafkaBrokers(props) {
    const kafkaClient = (0, createKafkaClient_1.default)({ region: props.region, credentials: props.credentials });
    const bootstrapBrokerInfo = await kafkaClient.send(new client_kafka_1.GetBootstrapBrokersCommand({ ClusterArn: props.kafkaArn }));
    return bootstrapBrokerInfo;
}
exports.default = getKafkaBrokers;
