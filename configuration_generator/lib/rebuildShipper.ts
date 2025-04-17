import child_process from 'child_process';
import {
  generateBuildImageCommand
} from './generateDockerCommands.js';

function rebuildImageAndContainer(
  containerName: string,
  imageName: string
) {
  child_process.execSync(generateBuildImageCommand(imageName),{
    stdio: 'inherit',
  });
}

export default rebuildImageAndContainer;