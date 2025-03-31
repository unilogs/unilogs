export interface FileSource {
  sourceName: string;
  include: string[];
}

export type Source = FileSource; // Ready to add new source types if we want.

export enum TransformSourceOption {
  Apache = 'apache_template',
  PlainText = 'plaintext_template',
}

interface BaseTransform {
  transformName: string;
  inputs: Source['sourceName'][];
  source: string;
}

export interface ApacheTransform extends BaseTransform {}

export interface PlainTextTransform extends BaseTransform {}

export type Transform = ApacheTransform | PlainTextTransform;

export enum SinkType {
  Console = 'console',
  Loki = 'loki',
  Kafka = 'kafka',
}

interface BaseSink {
  sinkName: string;
  type: SinkType;
  inputs: BaseTransform['transformName'][];
}

export interface LokiSink extends BaseSink {
  type: SinkType.Loki;
  endpoint: string;
  path: string;
  auth: {
    strategy: 'bearer';
    token: string;
  };
}

export interface KafkaSink extends BaseSink {
  type: SinkType.Kafka;
  bootstrap_servers: string;
  topic: 'app_logs_topic';
  encoding: {
    codec: 'json';
  };
}

export enum ConsoleEncoding {
  Logfmt = 'logfmt',
  Json = 'json',
}
export interface ConsoleSink extends BaseSink {
  type: SinkType.Console;
  encoding: ConsoleEncoding;
}

export type Sink = ConsoleSink | LokiSink | KafkaSink;
