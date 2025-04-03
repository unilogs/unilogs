import { getInternalDir, getLocalDir } from './pathUtils.js';
export function generateBuildImageCommand() {
    return `docker build -t unilogs-shipper:latest .`;
}
export function generateRunImageCommand(vectorConfiguration) {
    const runImageParts = ['docker run'];
    const includePaths = vectorConfiguration.getAllFileSourceIncludes();
    includePaths.forEach((includePath) => runImageParts.push(`-v ${getLocalDir(includePath)}:${getInternalDir(includePath)}`));
    runImageParts.push('--name unilogs-shipper -d unilogs-shipper:latest');
    return runImageParts.join(' ');
}
