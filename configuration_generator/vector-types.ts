export interface FileSource {
  sourceName: string;
  include: string[];
}

export type Source = FileSource; // Ready to add new source types if we want.

export enum TransformFile {
  Apache = './apache-remap.vrl',
  PlainText = './plaintext-remap.vrl',
}
interface BaseTransform {
  transformName: string;
  inputs: Source['sourceName'][];
  file: TransformFile;
}

export interface ApacheTransform extends BaseTransform {
  file: TransformFile.Apache;
}

export interface PlainTextTransform extends BaseTransform {
  file: TransformFile.PlainText;
}

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

export enum ConsoleEncoding {
  Logfmt = 'logfmt',
  Json = 'json',
}
export interface ConsoleSink extends BaseSink {
  type: SinkType.Console;
  encoding: ConsoleEncoding;
}

export type Sink = ConsoleSink | LokiSink;
