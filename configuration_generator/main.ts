#!/usr/bin/env node

import prompts from 'prompts';
import gradient from 'gradient-string';
import { VectorConfiguration } from './lib/VectorConfiguration.js';
import { ConsoleEncoding, ConsoleSink, SinkType } from './lib/Sink.js';
import {
  ApacheTransform,
  PlainTextTransform,
  Transform,
} from './lib/Transform.js';
import { FileSource, Source, SourceType } from './lib/Source.js';
import { stringify } from 'yaml';

const logo = `                            ██           ████    
                          ██▓██      ███████     
             ▒░▒███████████  ███ █████▓███       
              ▒▒  ███▓▒▒███ ██ █████▓███         
          ░░░███████▒▒█▓        ██████           
           ░▒ ██▓██░▓█    █   ░    ██            
       ░░▒██████▓█▒▒█    █    ░█▓█ ▒█            
       ░░░ ████▒██▒▓█   ▒█       ▒░ ██           
           ████░██░██    █▓          ▓██         
       ░░░░████░██▒▓█    ░███▒ ░▒▓     ██        
        ██ ████░██▒▒█▓    ▒███████▒   █░██       
       ████████▒░█▓░▒██     ██    ██   ██        
    ██████ ██ ██░▒█▓░░▓█▒    ▓██   ████          
   ▒▒▒  ██ ██ ███░▒██▒░░██░    ██                
    ▒▒  ██ ██  ███▒░▒██▒░░██░   ▒█               
        ██ ██    ██▓▒░▒██▒░░██   ██              
        ██ ███████████▒░▒██░░▒█  ░██             
        ██           ███▒▒▓█▒░▓█  ██             
        ██████████▒▒▒  ██▒▒▒█▒▒█▓██              
        ██    ██   ▒    ██▓▒▓█▒████              
       ▒▒▒▒  ▒▒▒▒         █▓▒█▒███               
        ▒▒    ▒▒          ██▓████                
                           █████                 
                           ███                   
                           ██                    `;

async function getMenuChoice() {
  return await prompts({
    type: 'select',
    name: 'menuChoice',
    message: 'What do you want to do?',
    choices: [
      { title: 'Add source and transform', value: 'add_source_and_transform' },
      { title: 'Add sink', value: 'add_sink' },
      { title: 'Map source/transform to sink', value: 'map_to_sink' },
      { title: 'Display vector config', value: 'viewConfig' },
      { title: 'Generate vector_shipper.yaml', value: 'generateYaml' },
      { title: 'Docker build and run shipper', value: 'buildAndRun' },
      { title: 'Exit', value: 'exit' },
    ],
  });
}

async function mapTransformToSink(vectorConfiguration: VectorConfiguration) {
  const availableSinks = vectorConfiguration.getAllSinkNames();
  const availableTransforms = vectorConfiguration.getAllTransformNames();
  if (availableSinks.length < 1 || availableTransforms.length < 1) return;
  const { selectedTransforms } = await prompts<string>({
    type: 'multiselect',
    name: 'selectedTransforms',
    message: 'Select all transforms you want to map to a sink',
    choices: availableTransforms.map(transformName => {return {title: transformName, value: transformName};}),
    instructions: false,
    min: 1,
    hint: '- Space to select, return to submit.'
  });
  const { selectedSink } = await prompts<string>({
    type: 'select',
    name: 'selectedSink',
    message: 'Select sink to map transforms to',
    choices: availableSinks.map(sinkName => {return {title: sinkName, value: sinkName};}),
  });
  const sinkToMapTo = vectorConfiguration.getSinkByName(selectedSink);
  if (sinkToMapTo.length !== 1) return;
  for (const transformName of selectedTransforms) {
    const transformToMap = vectorConfiguration.getTransformByName(transformName);
    if (transformToMap.length !== 1) return;
    sinkToMapTo[0].addInput(transformToMap[0]);
  }
}

async function addInclude(include: string[]) {
  const { includeToAdd } = await prompts<string>({
    type: 'text',
    name: 'includeToAdd',
    message: 'Enter path to logs',
  });
  if (includeToAdd) include.push(includeToAdd);
}

async function createSource(serviceName?: string): Promise<Source> {
  const { sourceName } = await prompts<string>({
    type: 'text',
    name: 'sourceName',
    message: 'What would you like to call this source?',
    initial: `${serviceName ? `${serviceName}_` : ''}file_source`,
    validate: (input) => /^[a-zA-Z0-9\-_]+$/.test(input),
  });
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
      { title: 'PlainText', value: 'plaintext' },
    ],
  });
  const { transformName } = await prompts<string>({
    type: 'text',
    name: 'transformName',
    message: 'What would you like to call this transform?',
    initial: `${serviceName}_${transformType}_transform`,
    validate: (input) => /^[a-zA-Z0-9\-_]+$/.test(input),
  });
  if (transformType === 'apache') {
    return new ApacheTransform({
      serviceName,
      inputs: [inputSource],
      transformName,
    });
  } else {
    return new PlainTextTransform({
      serviceName,
      inputs: [inputSource],
      transformName,
    });
  }
}

async function addSourceAndTransform(vectorConfiguration: VectorConfiguration) {
  const { serviceName } = await prompts<string>({
    type: 'text',
    name: 'serviceName',
    message: 'What is the service that generates these logs?',
    validate: (input) => /^[a-zA-Z0-9\-_]+$/.test(input),
  });
  const newSource = await createSource(serviceName);
  const newTransform = await createTransform(newSource, serviceName);
  vectorConfiguration.addSource(newSource);
  vectorConfiguration.addTransform(newTransform);
}

async function createConsoleSink(): Promise<ConsoleSink> {
  const { sinkName } = await prompts<string>({
    type: 'text',
    name: 'sinkName',
    message: 'What would you like to call this sink?',
    initial: 'console_sink',
    validate: (input) => /^[a-zA-Z0-9\-_]+$/.test(input),
  });
  const { encoding } = await prompts<string>({
    type: 'select',
    name: 'encoding',
    message: 'Which encoding would you like to use?',
    choices: [
      { title: 'JSON', value: ConsoleEncoding.Json },
      { title: 'Logfmt', value: ConsoleEncoding.Logfmt },
    ],
  });

  return new ConsoleSink({
    sinkName,
    type: SinkType.Console,
    encoding,
    inputs: [],
  });
}

async function addSink(vectorConfiguration: VectorConfiguration) {
  const { sinkType } = await prompts<string>({
    type: 'select',
    name: 'sinkType',
    message: 'Which sink type would you like to add?',
    choices: [
      { title: 'Console', value: SinkType.Console },
      { title: 'Loki', value: SinkType.Loki },
      { title: 'Kafka', value: SinkType.Kafka },
    ],
  });
  if (sinkType === 'console') {
    const sink = await createConsoleSink();
    vectorConfiguration.addSink(sink);
  }
}

async function viewConfig(vectorConfiguration: VectorConfiguration) {
  console.log(stringify(vectorConfiguration.objectify()));
  await prompts({
    type: 'confirm',
    name: 'confirmContinue',
    message: 'Yes to continue.',
  });
}

async function main() {
  const vectorConfiguration = new VectorConfiguration();
  let notDone = true;
  while (notDone) {
    console.clear();
    console.log(gradient(['aqua', 'purple']).multiline(logo));
    const action = await getMenuChoice();
    if (action.menuChoice === 'exit') notDone = false;
    if (action.menuChoice === 'add_sink') await addSink(vectorConfiguration);
    if (action.menuChoice === 'viewConfig')
      await viewConfig(vectorConfiguration);
    if (action.menuChoice === 'add_source_and_transform')
      await addSourceAndTransform(vectorConfiguration);
    if (action.menuChoice === 'map_to_sink') await mapTransformToSink(vectorConfiguration);
  }
}

void main();
