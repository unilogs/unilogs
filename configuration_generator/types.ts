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
}

export interface ApacheTransform extends BaseTransform {
  file: TransformFile.Apache;
}

export interface PlainTextTransform extends BaseTransform {
  file: TransformFile.PlainText;
}

export type Transform = ApacheTransform | PlainTextTransform;

interface BaseSink {
  sinkName: string;
  inputs: BaseTransform['transformName'][];
}

export interface LokiSink extends BaseSink {
  type: 'loki';
  endpoint: string;
  path: string;
  auth: {
    strategy: 'bearer';
    token: string;
  };
}

export interface ConsoleSink extends BaseSink {
  type: 'console';
  encoding: 'logfmt' | 'json';
}

export type Sink = ConsoleSink | LokiSink;
