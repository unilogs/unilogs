import { getInternalDir, getLocalDir } from './pathUtils.js';
import { VectorConfiguration } from './VectorConfiguration.js';

export function generateBuildImageCommand() {
  return `docker build -t unilogs-shipper:latest .`;
}

export function generateRunImageCommand(
  vectorConfiguration: VectorConfiguration
) {
  const runImageParts = ['docker run'];
  const includePaths = vectorConfiguration.getAllFileSourceIncludes();
  includePaths.forEach((includePath) =>
    runImageParts.push(
      `-v ${getLocalDir(includePath)}:${getInternalDir(includePath)}`
    )
  );
  runImageParts.push('--name unilogs-shipper -d unilogs-shipper:latest');
  return runImageParts.join(' ');
}
