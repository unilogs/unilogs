#!/usr/bin/env node
import prompts from "prompts";
import gradient from "gradient-string";
import { VectorConfiguration } from "./lib/VectorConfiguration.js";
import { ConsoleEncoding, ConsoleSink, SinkType } from "./lib/Sink.js";
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
            { title: 'Add source', value: 'add_source' },
            { title: 'Add sink', value: 'add_sink' },
            { title: 'Generate vector_shipper.yaml', value: 'generateYaml' },
            { title: 'Display vector config', value: 'viewConfig' },
            { title: 'Docker build and run shipper', value: 'buildAndRun' },
            { title: 'Exit', value: 'exit' }
        ]
    });
}
async function createConsoleSink() {
    const sinkNameResponse = await prompts({
        type: 'text',
        name: 'sinkName',
        message: 'What would you like to call this sink?',
        initial: 'console_sink',
        validate: (input) => /^[a-zA-Z0-9\-_]+$/.test(input)
    });
    const { encoding } = await prompts({
        type: 'select',
        name: 'encoding',
        message: 'Which encoding would you like to use?',
        choices: [
            { title: 'JSON', value: ConsoleEncoding.Json },
            { title: 'Logfmt', value: ConsoleEncoding.Logfmt }
        ]
    });
    const sinkName = (typeof sinkNameResponse.sinkName === 'string') ? sinkNameResponse.sinkName : '';
    return new ConsoleSink({ sinkName, type: SinkType.Console, encoding, inputs: [] });
}
async function addSink(vectorConfiguration) {
    const { sinkType } = await prompts({
        type: 'select',
        name: 'sinkType',
        message: 'Which sink type would you like to add?',
        choices: [
            { title: 'Console', value: SinkType.Console },
            { title: 'Loki', value: SinkType.Loki },
            { title: 'Kafka', value: SinkType.Kafka }
        ]
    });
    if (sinkType === 'console') {
        const sink = await createConsoleSink();
        vectorConfiguration.addSink(sink);
    }
}
async function viewConfig(vectorConfiguration) {
    console.log(vectorConfiguration.objectify());
    await prompts({
        type: 'confirm',
        name: 'confirmContinue',
        message: 'Yes to continue.'
    });
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
    }
}
void main();
