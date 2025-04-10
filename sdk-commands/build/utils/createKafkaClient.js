"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_kafka_1 = require("@aws-sdk/client-kafka");
function createKafkaClient(props) {
    const config = { region: props.region, credentials: props.credentials };
    return new client_kafka_1.KafkaClient(config);
}
exports.default = createKafkaClient;
