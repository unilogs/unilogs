# Notes on First Successful Deployment

1. I bootstrapped and deployed the cluster in a bash shell. To do this, I added a `.gitignore` file that ignores two bash files: `bootstrap.sh` and `deploy.sh`. You will need to create your own. They each contain the following code:

`export CDK_DEFAULT_ACCOUNT="your account number"`
`export CDK_DEFAULT_REGION="choose a default region"`
`export AWS_ACCESS_KEY_ID="your IAM user access key"`
`export AWS_SECRET_ACCESS_KEY="your secret access key"`

`cdk bootstrap` or `cdk deploy`, depending on the file

This temporarily provides the environment of the shell with the variables/values necessary to execute each command.

2. My initial choice of default region did not work. I tried to choose `us-west-1` initially, but it created a `us-east-1` environment instead, so I went with it and deployed there. I saw that the name of the environment variables could be `AWS_DEFAULT...` OR `CDK_DEFAULT...`, and the AWS CDK documentation seems to use both without explaination. Looking into it, it seems like I need to specify the region value using both in the environment. I should change the bootstrap and deploy files accordingly.

# General Notes / Concerns

1. Got a warning on the AWS EKS console when looking at the cluster, signed in as my IAM user (assigned to a group that has the full AdministratorAccess permissions policy):

"Your current IAM principal doesn’t have access to Kubernetes objects on this cluster.

This may be due to the current user or role not having Kubernetes RBAC permissions to describe cluster resources or not having an entry in the cluster’s auth config map."

2. Maybe related, error when trying to delete cluster through the console: "Missing credentials in config, if using AWS_CONFIG_FILE, set AWS_SDK_LOAD_CONFIG=1"

3. See various notes for other concerns in index.ts (outdated addon versions, etc.)
