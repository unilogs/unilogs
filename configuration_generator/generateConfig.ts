import { stringify } from 'yaml';
// import fs from 'fs';
// import prompts from 'prompts';
import { VectorConfiguration } from './VectorConfiguration';
import { ConsoleEncoding, SinkType, TransformFile } from './vector-types';

// const templateString = fs.readFileSync('./vector-shipper-template.yaml', 'utf8');

// const templateObject: unknown = parse(templateString);

// console.log(templateObject);

// fs.writeFileSync('./testWriteJsonTemplate.json', stringify(templateObject));

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

const testConfig = new VectorConfiguration();
testConfig.addSource({
  sourceName: 'test_apache_source',
  include: ['/logs/*.log'],
});
testConfig.addTransform({
  transformName: 'test_apache_transform',
  inputs: ['test_apache_source'],
  file: TransformFile.Apache,
});
testConfig.addSink({
  sinkName: 'console_sink',
  inputs: ['test_apache_transform'],
  type: SinkType.Console,
  encoding: ConsoleEncoding.Logfmt,
});

console.log(stringify(testConfig.objectify()));
