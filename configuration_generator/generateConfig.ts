import { stringify } from 'yaml';
// import fs from 'fs';
// import prompts from 'prompts';
import { VectorConfiguration } from './VectorConfiguration';

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

console.log(stringify(testConfig.objectify()));
