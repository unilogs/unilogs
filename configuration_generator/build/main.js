#!/usr/bin/env node
import prompts from "prompts";
import gradient from "gradient-string";
// import { ConfigGenerator } from "./ConfigGenerator";
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
// const configGenerator = new ConfigGenerator();
async function getMenuChoice() {
    return await prompts({
        type: 'select',
        name: 'menuChoice',
        message: 'What do you want to do?',
        choices: [
            { title: 'Add source', value: 'add_source' },
            { title: 'Add sink', value: 'add_sink' },
            { title: 'Generate vector_shipper.yaml', value: 'generateYaml' },
            { title: 'Docker build and run shipper', value: 'buildAndRun' },
            { title: 'Exit', value: 'exit' }
        ]
    });
}
async function main() {
    let notDone = true;
    while (notDone) {
        console.clear();
        console.log(gradient(['aqua', 'purple']).multiline(logo));
        const action = await getMenuChoice();
        if (action.menuChoice === 'exit')
            notDone = false;
    }
}
void main();
