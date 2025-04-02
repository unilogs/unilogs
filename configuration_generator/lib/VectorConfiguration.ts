import { Source, Transform } from './vector-types.js';
import { Sink } from './Sink.js';

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
        source: transform.source,
      };
    }

    const mySinks: Record<
      string,
      Record<string, string | string[] | Record<string, string | string[]>>
    > = {};
    for (const sink of this.sinks) {
      mySinks[sink.getSinkName()] = sink.getObjectBody();
    }

    return {
      sources: mySources,
      transforms: myTransforms,
      sinks: mySinks,
    };
  }

}
