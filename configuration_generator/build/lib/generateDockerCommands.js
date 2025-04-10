import { getInternalDir, getLocalDir } from './pathUtils.js';
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
    return runImageParts.join(' ');
}
