import child_process from 'child_process';
import {
  generateBuildImageCommand,
  generateRerunDockerImageCommand
} from './generateDockerCommands.js';

function rebuildImageAndContainer(
  imageName: string
) {
  child_process.execSync(generateBuildImageCommand(imageName),{
    stdio: 'inherit',
  });
  child_process.execSync(generateRerunDockerImageCommand(),{
    stdio: 'inherit',
  });
}

export default rebuildImageAndContainer;