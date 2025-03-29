import { Source, Transform, Sink } from './vector-types';

export class VectorConfiguration {
  private sources: Source[];
  private transforms: Transform[];
  private sinks: Sink[];

  constructor() {
    this.sources = [];
    this.transforms = [];
    this.sinks = [];
  }

  addSource(source: Source) {
    this.sources.push(source);
  }
  addTransform(transform: Transform) {
    this.transforms.push(transform);
  }
  addSink(sink: Sink) {
    this.sinks.push(sink);
  }

  objectify() {
    const mySources: Record<string, Record<string, string | string[]>> = {};
    for (const source of this.sources) {
      mySources[source.sourceName] = {
        type: 'file',
        include: source.include,
      };
    }

    const myTransforms: Record<string, Record<string, string | string[]>> = {};
    for (const transform of this.transforms) {
      myTransforms[transform.transformName] = {
        type: 'remap',
        inputs: transform.inputs,
        file: transform.file,
      };
    }

    const mySinks: Record<
      string,
      Record<string, string | string[] | Record<string, string | string[]>>
    > = {};
    for (const sink of this.sinks) {
      if (sink.type === 'loki') {
        mySinks[sink.sinkName] = {
          type: sink.type,
          endpoint: sink.endpoint,
          path: sink.path,
          auth: sink.auth,
          encoding: 'json'
        };
      } else if (sink.type === 'console') {
        mySinks[sink.sinkName] = {
          type: sink.type,
          inputs: sink.inputs,
          encoding: {codec: sink.encoding}
        };
      }
    }

    return {
      sources: mySources,
      transforms: myTransforms,
      sinks: mySinks,
    };
  }

  generateYamlConfig() {}
}
