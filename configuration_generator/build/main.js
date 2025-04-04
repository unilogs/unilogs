#!/usr/bin/env node
import prompts from 'prompts';
import gradient from 'gradient-string';
import { VectorConfiguration } from './lib/VectorConfiguration.js';
import { ConsoleEncoding, ConsoleSink, KafkaSink, LokiSink, SinkType, } from './lib/Sink.js';
import { ApacheTransform, PlainTextTransform, } from './lib/Transform.js';
import { FileSource, SourceType } from './lib/Source.js';
import { stringify } from 'yaml';
import fs from 'fs';
import logo from './lib/logo.js';
import generateDockerfile from './lib/generateDockerfile.js';
import { generateBuildImageCommand, generateRunImageCommand } from './lib/generateDockerCommands.js';
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
            { title: 'Save vector_shipper.yaml', value: 'saveYaml' },
            { title: 'Save Dockerfile', value: 'saveDockerfile' },
            { title: 'Docker build and run shipper', value: 'buildAndRun' },
            { title: 'Exit', value: 'exit' },
        ],
    });
}
async function mapTransformToSink(vectorConfiguration) {
    const availableSinks = vectorConfiguration.getAllSinkNames();
    const availableTransforms = vectorConfiguration.getAllTransformNames();
    if (availableSinks.length < 1 || availableTransforms.length < 1)
        return;
    const { selectedTransforms } = await prompts({
        type: 'multiselect',
        name: 'selectedTransforms',
        message: 'Select all transforms you want to map to a sink',
        choices: availableTransforms.map((transformName) => {
            return { title: transformName, value: transformName };
        }),
        instructions: false,
        min: 1,
        hint: '- Space to select, return to submit.',
    });
    const { selectedSink } = await prompts({
        type: 'select',
        name: 'selectedSink',
        message: 'Select sink to map transforms to',
        choices: availableSinks.map((sinkName) => {
            return { title: sinkName, value: sinkName };
        }),
    });
    const sinkToMapTo = vectorConfiguration.getSinkByName(selectedSink);
    if (sinkToMapTo.length !== 1)
        return;
    for (const transformName of selectedTransforms) {
        const transformToMap = vectorConfiguration.getTransformByName(transformName);
        if (transformToMap.length !== 1)
            return;
        sinkToMapTo[0].addInput(transformToMap[0]);
    }
}
async function addInclude(include) {
    const { includeToAdd } = await prompts({
        type: 'text',
        name: 'includeToAdd',
        message: 'Enter path to logs',
    });
    if (includeToAdd)
        include.push(includeToAdd);
}
async function createSource(serviceName) {
    const { sourceName } = await prompts({
        type: 'text',
        name: 'sourceName',
        message: 'What would you like to call this source?',
        initial: `${serviceName ? `${serviceName}_` : ''}file_source`,
        validate: (input) => /^[a-zA-Z0-9\-_]+$/.test(input),
    });
    const include = [];
    await addInclude(include);
    return new FileSource({ sourceName, type: SourceType.File, include });
}
async function createTransform(inputSource, serviceName) {
    const { transformType } = await prompts({
        type: 'select',
        name: 'transformType',
        message: 'Select log format',
        choices: [
            { title: 'Apache', value: 'apache' },
            { title: 'PlainText', value: 'plaintext' },
        ],
    });
    const { transformName } = await prompts({
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
    }
    else {
        return new PlainTextTransform({
            serviceName,
            inputs: [inputSource],
            transformName,
        });
    }
}
async function addSourceAndTransform(vectorConfiguration) {
    const { serviceName } = await prompts({
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
async function createConsoleSink() {
    const { sinkName } = await prompts({
        type: 'text',
        name: 'sinkName',
        message: 'What would you like to call this sink?',
        initial: 'console_sink',
        validate: (input) => /^[a-zA-Z0-9\-_]+$/.test(input),
    });
    const { encoding } = await prompts({
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
        encoding: { codec: encoding },
        inputs: [],
    });
}
async function createLokiSink() {
    const { sinkName } = await prompts({
        type: 'text',
        name: 'sinkName',
        message: 'What would you like to call this sink?',
        initial: 'loki_sink',
        validate: (input) => /^[a-zA-Z0-9\-_]+$/.test(input),
    });
    const { endpoint } = await prompts({
        type: 'text',
        name: 'endpoint',
        message: 'What is the endpoint?',
    });
    const { path } = await prompts({
        type: 'text',
        name: 'path',
        message: 'What is the path?',
    });
    const { authToken } = await prompts({
        type: 'text',
        name: 'authToken',
        message: 'What is the auth token?',
    });
    return new LokiSink({
        sinkName,
        type: SinkType.Loki,
        inputs: [],
        endpoint,
        path,
        auth: { strategy: 'bearer', token: authToken },
    });
}
async function createKafkaSink() {
    const { sinkName } = await prompts({
        type: 'text',
        name: 'sinkName',
        message: 'What would you like to call this sink?',
        initial: 'kafka_sink',
        validate: (input) => /^[a-zA-Z0-9\-_]+$/.test(input),
    });
    const { bootstrap_servers } = await prompts({
        type: 'text',
        name: 'bootstrap_servers',
        message: 'What are the bootstrap servers?',
    });
    return new KafkaSink({
        sinkName,
        type: SinkType.Kafka,
        inputs: [],
        bootstrap_servers,
    });
}
async function addSink(vectorConfiguration) {
    const { sinkType } = await prompts({
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
    else if (sinkType === 'loki') {
        const sink = await createLokiSink();
        vectorConfiguration.addSink(sink);
    }
    else if (sinkType === 'kafka') {
        const sink = await createKafkaSink();
        vectorConfiguration.addSink(sink);
    }
}
async function viewConfig(vectorConfiguration) {
    console.log(stringify(vectorConfiguration.objectify()));
    await prompts({
        type: 'confirm',
        name: 'confirmContinue',
        message: 'Enter to continue.',
        instructions: false,
        initial: true,
    });
}
function saveYaml(vectorConfiguration) {
    fs.writeFileSync('vector-shipper.yaml', stringify(vectorConfiguration.objectify()));
}
function saveDockerfile(vectorConfiguration) {
    fs.writeFileSync('Dockerfile', generateDockerfile(vectorConfiguration));
}
async function main() {
    const vectorConfiguration = new VectorConfiguration();
    let notDone = true;
    while (notDone) {
        console.clear();
        console.log(gradient(['aqua', 'purple']).multiline(logo));
        const action = await getMenuChoice();
        if (action.menuChoice === 'exit')
            notDone = false;
        if (action.menuChoice === 'add_sink')
            await addSink(vectorConfiguration);
        if (action.menuChoice === 'viewConfig')
            await viewConfig(vectorConfiguration);
        if (action.menuChoice === 'add_source_and_transform')
            await addSourceAndTransform(vectorConfiguration);
        if (action.menuChoice === 'map_to_sink')
            await mapTransformToSink(vectorConfiguration);
        if (action.menuChoice === 'saveYaml')
            saveYaml(vectorConfiguration);
        if (action.menuChoice === 'saveDockerfile')
            saveDockerfile(vectorConfiguration);
    }
    console.log(generateBuildImageCommand());
    console.log(generateRunImageCommand(vectorConfiguration));
}
void main();
