import { stringify } from 'yaml';
import fs from 'fs';
import { VectorConfiguration } from './VectorConfiguration';
import {
  ConsoleEncoding,
  SinkType,
  TransformSourceOption,
} from './vector-types';
import { TransformSource } from './TransformSource';
import {
  FileSource,
  ApacheTransform,
  PlainTextTransform,
  LokiSink,
  KafkaSink,
  ConsoleSink,
} from './vector-types';

// Name (default to log_source1 or whatever) -> use this for the "service" label
// Location

// Sources

//  Parsers
//    service => .unilogs_service_label=`${service}`

//  Sinks
//    Add 'loki' sync
//      url -> divide into endpoint + path
//      account:
//      bearer token:
//    Add 'kafka' sync
//      bootstrap_servers
//    Add 'console' sync
//      json, logfmt
// export class ConfigGenerator {}
const testConfig = new VectorConfiguration();

testConfig.addSource({
  sourceName: 'test_apache_source',
  include: ['/logs/*.log'],
});

const transformSource = new TransformSource(
  TransformSourceOption.Apache,
  'test_service_name'
);

testConfig.addTransform({
  transformName: 'test_apache_transform',
  inputs: ['test_apache_source'],
  source: transformSource.render(),
});

testConfig.addSink({
  sinkName: 'console_sink',
  inputs: ['test_apache_transform'],
  type: SinkType.Console,
  encoding: ConsoleEncoding.Logfmt,
});

console.log(testConfig.objectify());
fs.writeFileSync('./vector-shipper.yaml', stringify(testConfig.objectify()));
