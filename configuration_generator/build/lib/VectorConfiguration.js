export class VectorConfiguration {
    constructor() {
        this.sources = [];
        this.transforms = [];
        this.sinks = [];
    }
    addSource(source) {
        this.sources.push(source);
    }
    addTransform(transform) {
        this.transforms.push(transform);
    }
    addSink(sink) {
        this.sinks.push(sink);
    }
    objectify() {
        const mySources = {};
        for (const source of this.sources) {
            mySources[source.sourceName] = source.getObjectBody();
        }
        const myTransforms = {};
        for (const transform of this.transforms) {
            myTransforms[transform.transformName] = transform.getObjectBody();
        }
        const mySinks = {};
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
