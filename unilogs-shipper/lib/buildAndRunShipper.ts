import child_process from 'child_process';
import { VectorConfiguration } from './VectorConfiguration.js';
import {
  generateBuildImageCommand,
  generateRunImageCommand,
} from './generateDockerCommands.js';

function buildAndRunShipper(
  vectorConfiguration: VectorConfiguration,
  containerName: string,
  imageName: string
) {
  child_process.execSync(generateBuildImageCommand(imageName), {
    stdio: 'inherit',
  });
  child_process.execSync(
    generateRunImageCommand(vectorConfiguration, containerName, imageName),
    {
      stdio: 'inherit',
    }
  );
}

export default buildAndRunShipper;
