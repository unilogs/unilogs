import { getInternalDir, getLocalDir, readDockerCommand, writeDockerCommand } from './utils.js';
import { VectorConfiguration } from './VectorConfiguration.js';

const IMAGE_NAME = 'unilogs-shipper';
const CONTAINER_NAME = 'unilogs-shipper';

export function generateBuildImageCommand(imageName: string = IMAGE_NAME) {
  return `docker build -t ${imageName}:latest .`;
}

export function generateRunImageCommand(
  vectorConfiguration: VectorConfiguration,
  containerName: string = CONTAINER_NAME,
  imageName: string = IMAGE_NAME
) {
  const runImageParts = ['docker run'];
  const includePaths = vectorConfiguration.getAllFileSourceIncludes();
  includePaths.forEach((includePath) =>
    runImageParts.push(
      `-v ${getLocalDir(includePath)}:${getInternalDir(includePath)}`
    )
  );
  runImageParts.push(`--name ${containerName} -d ${imageName}:latest`);
  
  const command = runImageParts.join(' ');
  writeDockerCommand(command);
  return command;
}

export function generateDeleteImageCommand(imageName: string = IMAGE_NAME) {
  return `docker rmi ${imageName}`;
}


export function generateDeleteContainerCommand(containerName: string = CONTAINER_NAME) {
  return `docker rm -v ${containerName}`;
}

export function generateStopContainerCommand(containerName: string = CONTAINER_NAME) {
  return `docker stop ${containerName}`;
}

export function generateRerunDockerImageCommand() {
  return readDockerCommand();
}