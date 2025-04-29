import child_process from 'child_process';
import {
  generateDeleteImageCommand,
  generateDeleteContainerCommand,
  generateStopContainerCommand,
} from './generateDockerCommands.js';

function deleteContainerAndImage(
  containerName: string,
  imageName: string
) {
  child_process.execSync(generateStopContainerCommand(containerName), {
    stdio: 'inherit',
  });
  child_process.execSync(generateDeleteContainerCommand(containerName), {
    stdio: 'inherit',
  });
  child_process.execSync(generateDeleteImageCommand(imageName),{
    stdio: 'inherit',
  });
}

export default deleteContainerAndImage;
