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
            mySources[source.sourceName] = {
                type: 'file',
                include: source.include,
            };
        }
        const myTransforms = {};
        for (const transform of this.transforms) {
            myTransforms[transform.transformName] = {
                type: 'remap',
                inputs: transform.inputs,
                source: transform.source,
            };
        }
        const mySinks = {};
        for (const sink of this.sinks) {
            // if (sink.type === SinkType.Loki) {
            //   mySinks[sink.sinkName] = {
            //     type: sink.type,
            //     endpoint: sink.endpoint,
            //     path: sink.path,
            //     auth: sink.auth,
            //     encoding: 'json',
            //   };
            // } else if (sink.type === SinkType.Console) {
            //   mySinks[sink.sinkName] = {
            //     type: sink.type,
            //     inputs: sink.inputs,
            //     encoding: { codec: sink.encoding },
            //   };
            // } else if (sink.type === SinkType.Kafka) {
            //   mySinks[sink.sinkName] = {
            //     type: sink.type,
            //     inputs: sink.inputs,
            //     bootstrap_servers: sink.bootstrap_servers,
            //     topic: sink.topic,
            //     encoding: sink.encoding,
            //   };
            // }
            mySinks[sink.getSinkName()] = sink.getObjectBody();
        }
        return {
            sources: mySources,
            transforms: myTransforms,
            sinks: mySinks,
        };
    }
}
