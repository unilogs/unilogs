import Dockerode from 'dockerode';
const docker = new Dockerode();
async function getContainerIdByName(containerName) {
    const containerList = await docker.listContainers();
    const filteredContainers = containerList.filter((containerInfo) => containerInfo.Names.includes(`/${containerName}`));
    if (filteredContainers.length < 1)
        return '';
    return filteredContainers[0].Id;
}
export default getContainerIdByName;
