import { VectorConfiguration } from './VectorConfiguration.js';
import { getInternalDir } from './pathUtils.js';

const dockerfile = [
  'FROM timberio/vector:latest-distroless-static',
  'ADD ./vector-shipper.yaml /etc/vector/vector.yaml',
];

function generateDockerfile(vectorConfiguration: VectorConfiguration) {
  const includePaths = vectorConfiguration.getAllFileSourceIncludes();
  includePaths.forEach((includePath) =>
    dockerfile.push(`VOLUME ${getInternalDir(includePath)}`)
  );
  return dockerfile.join('\n');
}

export default generateDockerfile;
