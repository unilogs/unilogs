import child_process from 'child_process';
import { VectorConfiguration } from './VectorConfiguration.js';
import {
  generateBuildImageCommand,
  generateRunImageCommand,
} from './generateDockerCommands.js';

function buildAndRunShipper(vectorConfiguration: VectorConfiguration) {
  child_process.execSync(generateBuildImageCommand(), { stdio: 'inherit' });
  child_process.execSync(generateRunImageCommand(vectorConfiguration), {
    stdio: 'inherit',
  });
}

export default buildAndRunShipper;
