#!/usr/bin/env node

import prompts from 'prompts';
import gradient from 'gradient-string';
import { VectorConfiguration } from './lib/VectorConfiguration.js';
import {
  // ConsoleEncoding,
  // ConsoleSink,
  KafkaSink,
  // LokiSink,
  SinkType,
  // safeAssertConsoleEncoding,
} from './lib/Sink.js';
import {
  ApacheTransform,
  ClfTransform,
  LinuxAuthorizationTransform,
  LogfmtTransform,
  PlainTextTransform,
  SyslogTransform,
  Transform,
} from './lib/Transform.js';
import { FileSource, Source, SourceType } from './lib/Source.js';
import { stringify } from 'yaml';
import fs from 'fs';
import logo from './lib/logo.js';
import generateDockerfile from './lib/generateDockerfile.js';
// import {
//   generateBuildImageCommand,
//   generateRunImageCommand,
// } from './lib/generateDockerCommands.js';
import buildAndRunShipper from './lib/buildAndRunShipper.js';
import safeAssertString from './lib/safeAssertString.js';
import getContainerIdByName from './lib/getContainerIdByName.js';

const IMAGE_NAME = 'unilogs-shipper';
const CONTAINER_NAME = 'unilogs-shipper';

// async function getPowerUserMenuChoice() {
//   return await prompts({
//     type: 'select',
//     name: 'menuChoice',
//     message: 'What do you want to do?',
//     choices: [
//       { title: 'Add source and transform', value: 'add_source_and_transform' },
//       { title: 'Add sink', value: 'add_sink' },
//       { title: 'Map source/transform to sink', value: 'map_to_sink' },
//       { title: 'Display vector config', value: 'viewConfig' },
//       { title: 'Save vector_shipper.yaml', value: 'saveYaml' },
//       { title: 'Save Dockerfile', value: 'saveDockerfile' },
//       { title: 'Docker build and run shipper', value: 'buildAndRun' },
//       { title: 'Exit', value: 'exit' },
//     ],
//   });
// }

async function getSimpleMenuChoice() {
  const { menuChoice } = await prompts<string>({
    type: 'autocomplete',
    name: 'menuChoice',
    message: 'Add at least one source, then run shipper',
    choices: [
      { title: 'Add log file source', value: 'add_file_source_and_transform' },
      { title: 'Build and run shipper', value: 'add_sink_build_and_run' },
      { title: 'Cancel and exit', value: 'exit' },
    ],
  });
  safeAssertString(menuChoice);
  return menuChoice;
}

// async function mapTransformToSink(vectorConfiguration: VectorConfiguration) {
//   const availableSinks = vectorConfiguration.getAllSinkNames();
//   const availableTransforms = vectorConfiguration.getAllTransformNames();
//   if (availableSinks.length < 1 || availableTransforms.length < 1) return;
//   const { selectedTransforms } = await prompts<string>({
//     type: 'multiselect',
//     name: 'selectedTransforms',
//     message: 'Select all transforms you want to map to a sink',
//     choices: availableTransforms.map((transformName) => {
//       return { title: transformName, value: transformName };
//     }),
//     instructions: false,
//     min: 1,
//     hint: '- Space to select, return to submit.',
//   });
//   safeAssertString(selectedTransforms);
//   const { selectedSink } = await prompts<string>({
//     type: 'select',
//     name: 'selectedSink',
//     message: 'Select sink to map transforms to',
//     choices: availableSinks.map((sinkName) => {
//       return { title: sinkName, value: sinkName };
//     }),
//   });
//   safeAssertString(selectedSink);
//   const sinkToMapTo = vectorConfiguration.getSinkByName(selectedSink);
//   if (sinkToMapTo.length !== 1) return;
//   for (const transformName of selectedTransforms) {
//     const transformToMap =
//       vectorConfiguration.getTransformByName(transformName);
//     if (transformToMap.length !== 1) return;
//     sinkToMapTo[0].addInput(transformToMap[0]);
//   }
// }

async function addInclude(include: string[]) {
  const { includeToAdd } = await prompts<string>({
    type: 'text',
    name: 'includeToAdd',
    message: 'Enter path to logs',
  });
  safeAssertString(includeToAdd);
  if (includeToAdd) include.push(includeToAdd);
}

async function createSource(serviceName: string): Promise<Source> {
  const sourceName = `${serviceName ? `${serviceName}_` : ''}file_source`;
  safeAssertString(sourceName);
  const include: string[] = [];
  await addInclude(include);
  return new FileSource({ sourceName, type: SourceType.File, include });
}

async function createTransform(
  inputSource: Source,
  serviceName: string
): Promise<Transform> {
  const { transformType } = await prompts<string>({
    type: 'select',
    name: 'transformType',
    message: 'Select log format',
    choices: [
      { title: 'Apache', value: 'apache' },
      { title: 'Common Log Format (CLF)', value: 'clf' },
      { title: 'Linux Authorization', value: 'linux_authorization' },
      { title: 'Logfmt', value: 'logfmt' },
      { title: 'Syslog', value: 'syslog' },
    ],
  });
  safeAssertString(transformType);
  const transformName = `${serviceName}_${transformType}_transform`;
  if (transformType === 'apache') {
    return new ApacheTransform({
      serviceName,
      inputs: [inputSource],
      transformName,
    });
  } else if (transformType === 'clf') {
    return new ClfTransform({
      serviceName,
      inputs: [inputSource],
      transformName
    });
  } else if (transformType === 'linux_authorization') {
    return new LinuxAuthorizationTransform({
      serviceName,
      inputs: [inputSource],
      transformName
    });
  } else if (transformType === 'logfmt') {
    return new LogfmtTransform({
      serviceName,
      inputs: [inputSource],
      transformName
    });
  } else if (transformType === 'syslog') {
    return new SyslogTransform({
      serviceName,
      inputs: [inputSource],
      transformName
    });
  } else {
    return new PlainTextTransform({
      serviceName,
      inputs: [inputSource],
      transformName,
    });
  }
}

// async function addSourceAndTransform(vectorConfiguration: VectorConfiguration) {
//   const { serviceName } = await prompts<string>({
//     type: 'text',
//     name: 'serviceName',
//     message: 'What is the service that generates these logs?',
//     validate: (input: string) => /^[a-zA-Z0-9\-_]+$/.test(input),
//   });
//   safeAssertString(serviceName);
//   const newSource = await createSource(serviceName);
//   const newTransform = await createTransform(newSource, serviceName);
//   vectorConfiguration.addSource(newSource);
//   vectorConfiguration.addTransform(newTransform);
// }

async function simpleAddSourceAndTransform(
  vectorConfiguration: VectorConfiguration
) {
  const { serviceName } = await prompts<string>({
    type: 'text',
    name: 'serviceName',
    message: 'What is the service that generates these logs?',
    validate: (input: string) => /^[a-zA-Z0-9\-_]+$/.test(input),
  });
  safeAssertString(serviceName);
  const newSource = await createSource(serviceName);
  const newTransform = await createTransform(newSource, serviceName);
  vectorConfiguration.addSource(newSource);
  vectorConfiguration.addTransform(newTransform);
}

// async function createConsoleSink(): Promise<ConsoleSink> {
//   const { sinkName } = await prompts<string>({
//     type: 'text',
//     name: 'sinkName',
//     message: 'What would you like to call this sink?',
//     initial: 'console_sink',
//     validate: (input: string) => /^[a-zA-Z0-9\-_]+$/.test(input),
//   });
//   safeAssertString(sinkName);
//   const { encoding } = await prompts<string>({
//     type: 'select',
//     name: 'encoding',
//     message: 'Which encoding would you like to use?',
//     choices: [
//       { title: 'JSON', value: ConsoleEncoding.Json },
//       { title: 'Logfmt', value: ConsoleEncoding.Logfmt },
//     ],
//   });
//   safeAssertConsoleEncoding(encoding);

//   return new ConsoleSink({
//     sinkName,
//     type: SinkType.Console,
//     encoding: { codec: encoding },
//     inputs: [],
//   });
// }

// async function createLokiSink(): Promise<LokiSink> {
//   const { sinkName } = await prompts<string>({
//     type: 'text',
//     name: 'sinkName',
//     message: 'What would you like to call this sink?',
//     initial: 'loki_sink',
//     validate: (input: string) => /^[a-zA-Z0-9\-_]+$/.test(input),
//   });
//   safeAssertString(sinkName);
//   const { endpoint } = await prompts<string>({
//     type: 'text',
//     name: 'endpoint',
//     message: 'What is the endpoint?',
//   });
//   safeAssertString(endpoint);
//   const { path } = await prompts<string>({
//     type: 'text',
//     name: 'path',
//     message: 'What is the path?',
//   });
//   safeAssertString(path);
//   const { authToken } = await prompts<string>({
//     type: 'text',
//     name: 'authToken',
//     message: 'What is the auth token?',
//   });
//   safeAssertString(authToken);
//   return new LokiSink({
//     sinkName,
//     type: SinkType.Loki,
//     inputs: [],
//     endpoint,
//     path,
//     auth: { strategy: 'bearer', token: authToken },
//   });
// }

async function createKafkaSink(): Promise<KafkaSink> {
  const sinkName = 'kafka_sink';
  const { bootstrap_servers } = await prompts<string>({
    type: 'text',
    name: 'bootstrap_servers',
    message: 'What are the bootstrap servers?',
  });
  safeAssertString(bootstrap_servers);
  const { username } = await prompts<string>({
    type: 'text',
    name: 'username',
    message: 'SCRAM username',
  });
  safeAssertString(username);
  const { password } = await prompts<string>({
    type: 'password',
    name: 'password',
    message: 'SCRAM password',
  });
  safeAssertString(password);
  return new KafkaSink({
    sinkName,
    type: SinkType.Kafka,
    inputs: [],
    bootstrap_servers,
    sasl: { enabled: true, mechanism: 'SCRAM-SHA-512', username, password },
  });
}

// async function addSink(vectorConfiguration: VectorConfiguration) {
//   const { sinkType } = await prompts<string>({
//     type: 'select',
//     name: 'sinkType',
//     message: 'Which sink type would you like to add?',
//     choices: [
//       { title: 'Console', value: SinkType.Console },
//       { title: 'Loki', value: SinkType.Loki },
//       { title: 'Kafka', value: SinkType.Kafka },
//     ],
//   });
//   if (sinkType === 'console') {
//     const sink = await createConsoleSink();
//     vectorConfiguration.addSink(sink);
//   } else if (sinkType === 'loki') {
//     const sink = await createLokiSink();
//     vectorConfiguration.addSink(sink);
//   } else if (sinkType === 'kafka') {
//     const sink = await createKafkaSink();
//     vectorConfiguration.addSink(sink);
//   }
// }

// async function viewConfig(vectorConfiguration: VectorConfiguration) {
//   console.log(stringify(vectorConfiguration.objectify()));
//   await prompts({
//     type: 'confirm',
//     name: 'confirmContinue',
//     message: 'Enter to continue.',
//     instructions: false,
//     initial: true,
//   });
// }

function saveYaml(vectorConfiguration: VectorConfiguration) {
  fs.writeFileSync(
    'vector-shipper.yaml',
    stringify(vectorConfiguration.objectify())
  );
}

function saveDockerfile(vectorConfiguration: VectorConfiguration) {
  fs.writeFileSync('Dockerfile', generateDockerfile(vectorConfiguration));
}

async function addSinkBuildAndRun(vectorConfiguration: VectorConfiguration) {
  vectorConfiguration.addSink(await createKafkaSink());

  const availableSinks = vectorConfiguration.getAllSinkNames();
  const availableTransforms = vectorConfiguration.getAllTransformNames();
  if (availableSinks.length !== 1 || availableTransforms.length < 1) return;
  const sinkToMapTo = vectorConfiguration.getSinkByName(availableSinks[0]);
  if (sinkToMapTo.length !== 1) return;
  for (const transformName of availableTransforms) {
    const transformToMap =
      vectorConfiguration.getTransformByName(transformName);
    if (transformToMap.length !== 1) return;
    sinkToMapTo[0].addInput(transformToMap[0]);
  }
  saveYaml(vectorConfiguration);
  saveDockerfile(vectorConfiguration);
  buildAndRunShipper(vectorConfiguration, CONTAINER_NAME, IMAGE_NAME);
}

async function main() {
  const vectorConfiguration = new VectorConfiguration();
  let notDone = true;
  if (await getContainerIdByName(CONTAINER_NAME) !== '') {
    console.log(`A container named ${CONTAINER_NAME} is already running.`);
    console.log('Please delete it and then try again.');
    notDone = false;
  }
  while (notDone) {
    console.clear();
    console.log(gradient(['aqua', 'purple']).multiline(logo));
    const action = await getSimpleMenuChoice();
    if (action === 'exit') notDone = false;
    if (action === 'add_file_source_and_transform')
      await simpleAddSourceAndTransform(vectorConfiguration);
    if (action === 'add_sink_build_and_run') {
      await addSinkBuildAndRun(vectorConfiguration);
      notDone = false;
    }
    // const action = await getPowerUserMenuChoice();
    // if (action.menuChoice === 'exit') {
    //   notDone = false;
    //   console.log(generateBuildImageCommand());
    //   console.log(generateRunImageCommand(vectorConfiguration));
    // }
    // if (action.menuChoice === 'add_sink') await addSink(vectorConfiguration);
    // if (action.menuChoice === 'viewConfig')
    //   await viewConfig(vectorConfiguration);
    // if (action.menuChoice === 'add_source_and_transform')
    //   await addSourceAndTransform(vectorConfiguration);
    // if (action.menuChoice === 'map_to_sink')
    //   await mapTransformToSink(vectorConfiguration);
    // if (action.menuChoice === 'saveYaml') saveYaml(vectorConfiguration);
    // if (action.menuChoice === 'saveDockerfile')
    //   saveDockerfile(vectorConfiguration);
    // if (action.menuChoice === 'buildAndRun') {
    //   notDone = false;
    //   buildAndRunShipper(vectorConfiguration);
    // }
  }
}

void main();
