import { Transform } from "./Transform.js"; // todo: change to Transform class

export enum SinkType {
  Console = 'console',
  Loki = 'loki',
  Kafka = 'kafka',
}
export interface LokiSinkAuthProps {
  strategy: 'bearer';
  token: string;
}

interface BaseSinkProps {
  sinkName: string;
  type: SinkType;
  inputs: Transform[];
}

export interface LokiSinkProps extends BaseSinkProps {
  type: SinkType.Loki;
  endpoint: string;
  path: string;
  auth: LokiSinkAuthProps;
}

export interface KafkaSinkProps extends BaseSinkProps {
  type: SinkType.Kafka;
  bootstrap_servers: string;
}

export enum ConsoleEncoding {
  Logfmt = 'logfmt',
  Json = 'json',
}
export interface ConsoleSinkProps extends BaseSinkProps {
  type: SinkType.Console;
  encoding: ConsoleEncoding;
}

class BaseSink {
  readonly sinkName: BaseSinkProps['sinkName'];
  private type: BaseSinkProps['type'];
  private inputs: BaseSinkProps['inputs'];

  constructor(props: BaseSinkProps) {
    this.sinkName = props.sinkName;
    this.type = props.type;
    this.inputs = props.inputs;
  }

  addInput(input: Transform) {
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
  private endpoint: LokiSinkProps['endpoint'];
  private path: LokiSinkProps['path'];
  private auth: LokiSinkProps['auth'];

  constructor(props: LokiSinkProps) {
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
  private bootstrap_servers: KafkaSinkProps['bootstrap_servers'];
  private topic: 'app_logs_topic';
  private encoding: { codec: 'json' };

  constructor(props: KafkaSinkProps) {
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
  private encoding: ConsoleSinkProps['encoding'];

  constructor(props: ConsoleSinkProps) {
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

export type Sink = LokiSink | KafkaSink | ConsoleSink;
