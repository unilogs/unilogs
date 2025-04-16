import { Transform } from './Transform.js'; // todo: change to Transform class

export enum SinkType {
  Console = 'console',
  Loki = 'loki',
  Kafka = 'kafka',
}
interface LokiSinkBasicAuthProps {
  strategy: 'basic';
  username: string;
  password: string;
}
interface LokiSinkBearerAuthProps {
  strategy: 'bearer';
  token: string;
}
export type LokiSinkAuthProps =
  | LokiSinkBasicAuthProps
  | LokiSinkBearerAuthProps;

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

interface KafkaSinkSaslConfig {
  enabled: boolean;
  mechanism: 'SCRAM-SHA-256' | 'SCRAM-SHA-512' | 'plain';
  password: string;
  username: string;
}
export interface KafkaSinkProps extends BaseSinkProps {
  type: SinkType.Kafka;
  bootstrap_servers: string;
  sasl?: KafkaSinkSaslConfig;
}

export enum ConsoleEncoding {
  Logfmt = 'logfmt',
  Json = 'json',
}
export function safeAssertConsoleEncoding(
  val: unknown
): asserts val is ConsoleEncoding {
  if (typeof val !== 'string') throw new Error('Expected a ConsoleEncoding');
  if (
    !Object.values(ConsoleEncoding)
      .map((encoding) => encoding.toString())
      .includes(val)
  )
    throw new Error('Expected a ConsoleEncoding');
}

export interface ConsoleSinkProps extends BaseSinkProps {
  type: SinkType.Console;
  encoding: { codec: ConsoleEncoding };
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
      auth:
        this.auth.strategy === 'bearer'
          ? { strategy: this.auth.strategy, token: this.auth.token }
          : {
              strategy: this.auth.strategy,
              username: this.auth.username,
              password: this.auth.password,
            },
    };
    return returnBody;
  }
}

export class KafkaSink extends BaseSink {
  private bootstrap_servers: KafkaSinkProps['bootstrap_servers'];
  private topic: 'app_logs_topic';
  private encoding: { codec: 'json' };
  private sasl: KafkaSinkSaslConfig | undefined;

  constructor(props: KafkaSinkProps) {
    super(props);
    this.bootstrap_servers = props.bootstrap_servers;
    this.topic = 'app_logs_topic';
    this.encoding = { codec: 'json' };
    this.sasl = props.sasl;
  }

  getObjectBody() {
    const returnBody = {
      ...super.getObjectBody(),
      bootstrap_servers: this.bootstrap_servers,
      topic: this.topic,
      encoding: this.encoding,
      sasl:
        this.sasl === undefined
          ? { enabled: false }
          : {
              enabled: this.sasl.enabled,
              mechanism: this.sasl.mechanism,
              username: this.sasl.username,
              password: this.sasl.password,
            },
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
