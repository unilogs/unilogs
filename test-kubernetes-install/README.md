This directory is being used after having been created previously with only a values.yaml file. This values.yaml file has been moved into a `chart-values` directory, but is not being used when running `CDK deploy` (through a bash file which exports the AWS region and keys).

This directory is designed to allow deployment of a cluster (with two S3 buckets) set up to use AWS EKS Auto Mode prior to any helm chart installations. Deploy, and then you can go to the AWS EKS console and turn Auto Mode on if desired (not yet sure why it isn't on by default).

With this test deployment (regardless of whether Auto Mode is used), configuration of helm charts can be tested independently of cluster deployment using `kubectl` and `helm` in the command line. Bucket and cluster config may also be tested in a similar way, by tweaking the CDK code independent of the helm installations.

Be sure to install the cluster using a different default region, to avoid conflicts with the 'CDKToolkit' name of the bootstrap stack, or accidentally modifying/deleting the wrong stacks/resources.
