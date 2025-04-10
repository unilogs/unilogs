import { Sink } from './Sink.js';
import { Source, SourceType } from './Source.js';
import { Transform } from './Transform.js';

export class VectorConfiguration {
  private sources: Source[];
  private transforms: Transform[];
  private sinks: Sink[];

  constructor() {
    this.sources = [];
    this.transforms = [];
    this.sinks = [];
  }

  getAllFileSourceIncludes() {
    const fileSources = this.sources.filter(
      (source) => source.type === SourceType.File
    );
    return fileSources.flatMap(source => source.getInclude());
  }

  getAllTransformNames() {
    return this.transforms.map((transform) => transform.transformName);
  }

  getAllSinkNames() {
    return this.sinks.map((sink) => sink.sinkName);
  }

  getSinkByName(sinkName: string): Sink[] {
    return this.sinks.filter((sink) => sink.sinkName === sinkName);
  }

  getTransformByName(transformName: string): Transform[] {
    return this.transforms.filter(
      (transform) => transform.transformName === transformName
    );
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
      mySources[source.sourceName] = source.getObjectBody();
    }

    const myTransforms: Record<string, Record<string, string | string[]>> = {};
    for (const transform of this.transforms) {
      myTransforms[transform.transformName] = transform.getObjectBody();
    }

    const mySinks: Record<
      string,
      Record<string, string | string[] | Record<string, string | string[] | boolean>>
    > = {};
    for (const sink of this.sinks) {
      mySinks[sink.sinkName] = sink.getObjectBody();
    }

    return {
      sources: mySources,
      transforms: myTransforms,
      sinks: mySinks,
    };
  }
}
