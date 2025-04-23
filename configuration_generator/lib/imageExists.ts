import Dockerode from 'dockerode';

const docker = new Dockerode();

async function imageExists(imageName: string) {
  const imageList = await docker.listImages();
  const filteredImages = imageList.filter((imageInfo) =>
    imageInfo.RepoTags && imageInfo.RepoTags[0] === `${imageName}:latest`
  );

  return filteredImages.length === 1; 
}

export default imageExists;
