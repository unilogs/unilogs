This directory is being used after having been created previously with only a values.yaml file. This values.yaml file has been moved into a `chart-values` directory, but is not being used when running `CDK deploy` (through a bash file which exports the AWS region and keys).

This directory is just to launch an EKS cluster with some buckets, so that configuration of helm charts can be tested independently of cluster deployment using `kubectl` and `helm` in the command line. Bucket and cluster config may also be tested in a similar way, by tweaking the CDK code independent of the helm installations.

Be sure to install the cluster using a different default region, to avoid conflicts with the 'CDKToolkit' name of the bootstrap stack, or accidentally modifying/deleting the wrong stacks/resources.
