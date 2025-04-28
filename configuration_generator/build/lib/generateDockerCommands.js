import { getInternalDir, getLocalDir, readDockerCommand, writeDockerCommand } from './utils.js';
const IMAGE_NAME = 'unilogs-shipper';
const CONTAINER_NAME = 'unilogs-shipper';
export function generateBuildImageCommand(imageName = IMAGE_NAME) {
    return `docker build -t ${imageName}:latest .`;
}
export function generateRunImageCommand(vectorConfiguration, containerName = CONTAINER_NAME, imageName = IMAGE_NAME) {
    const runImageParts = ['docker run'];
    const includePaths = vectorConfiguration.getAllFileSourceIncludes();
    includePaths.forEach((includePath) => runImageParts.push(`-v ${getLocalDir(includePath)}:${getInternalDir(includePath)}`));
    runImageParts.push(`--name ${containerName} -d ${imageName}:latest`);
    const command = runImageParts.join(' ');
    writeDockerCommand(command);
    return command;
}
export function generateDeleteImageCommand(imageName = IMAGE_NAME) {
    return `docker rmi ${imageName}`;
}
export function generateDeleteContainerCommand(containerName = CONTAINER_NAME) {
    return `docker rm -v ${containerName}`;
}
export function generateStopContainerCommand(containerName = CONTAINER_NAME) {
    return `docker stop ${containerName}`;
}
export function generateRerunDockerImageCommand() {
    return readDockerCommand();
}
