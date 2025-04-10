import { getInternalDir, getLocalDir } from './pathUtils.js';
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
  return runImageParts.join(' ');
}
