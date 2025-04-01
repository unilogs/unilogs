import { stringify } from 'yaml';
import { VectorConfiguration } from './VectorConfiguration.js';
import { SinkType, } from './vector-types.js';
import { TransformSource } from './TransformSource.js';
export class ConfigGenerator {
    constructor() {
        this.vectorConfig = new VectorConfiguration();
        this.logSources = [];
    }
    addSource(serviceName, include, transformType) {
        const newSource = {
            service: serviceName,
            sourceName: `${serviceName}_source`,
        };
        this.logSources.push(newSource);
        this.vectorConfig.addSource({
            sourceName: newSource.sourceName, // 'test_apache_source',
            include, //['/logs/*.log'],
        });
        const transformSource = new TransformSource(transformType, newSource.service);
        this.vectorConfig.addTransform({
            transformName: 'test_apache_transform',
            inputs: [newSource.sourceName],
            source: transformSource.render(),
        });
    }
    addSink(sinkName, inputs, type, encoding, endpoint, path, auth) {
        if (type === SinkType.Console && encoding) {
            this.vectorConfig.addSink({
                sinkName, // 'console_sink',
                inputs, // ['test_apache_transform'],
                type,
                encoding, //: ConsoleEncoding.Logfmt,
            });
        }
        else if (type === SinkType.Loki && endpoint && path && auth) {
            this.vectorConfig.addSink({
                sinkName, // 'console_sink',
                inputs, // ['test_apache_transform'],
                type,
                endpoint,
                path,
                auth
            });
        }
    }
    getObject() {
        return this.vectorConfig.objectify();
    }
    getYaml() {
        return stringify(this.getObject());
    }
}
