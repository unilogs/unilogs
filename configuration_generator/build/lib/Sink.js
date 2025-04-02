export var SinkType;
(function (SinkType) {
    SinkType["Console"] = "console";
    SinkType["Loki"] = "loki";
    SinkType["Kafka"] = "kafka";
})(SinkType || (SinkType = {}));
export var ConsoleEncoding;
(function (ConsoleEncoding) {
    ConsoleEncoding["Logfmt"] = "logfmt";
    ConsoleEncoding["Json"] = "json";
})(ConsoleEncoding || (ConsoleEncoding = {}));
class BaseSink {
    constructor(props) {
        this.sinkName = props.sinkName;
        this.type = props.type;
        this.inputs = props.inputs;
    }
    addInput(input) {
        this.inputs.push(input);
    }
    getSinkName() {
        return this.sinkName;
    }
    getObjectBody() {
        return {
            type: this.type,
            inputs: this.inputs.map((input) => input.transformName),
        };
    }
}
export class LokiSink extends BaseSink {
    constructor(props) {
        super(props);
        this.endpoint = props.endpoint;
        this.path = props.path;
        this.auth = props.auth;
    }
    getObjectBody() {
        const returnBody = {
            ...super.getObjectBody(),
            endpoint: this.endpoint,
            path: this.path,
            auth: { strategy: this.auth.strategy, token: this.auth.token },
        };
        return returnBody;
    }
}
export class KafkaSink extends BaseSink {
    constructor(props) {
        super(props);
        this.bootstrap_servers = props.bootstrap_servers;
        this.topic = 'app_logs_topic';
        this.encoding = { codec: 'json' };
    }
    getObjectBody() {
        const returnBody = {
            ...super.getObjectBody(),
            bootstrap_servers: this.bootstrap_servers,
            topic: this.topic,
            encoding: this.encoding,
        };
        return returnBody;
    }
}
export class ConsoleSink extends BaseSink {
    constructor(props) {
        super(props);
        this.encoding = props.encoding;
    }
    getObjectBody() {
        const returnBody = {
            ...super.getObjectBody(),
            encoding: this.encoding,
        };
        return returnBody;
    }
}
