# Deployment Prerequisites and Process

I bootstrapped and deployed the cluster in a bash shell. To do this, I added a `.gitignore` file that ignores two bash files: `bootstrap.sh` and `deploy.sh`. You will need to create your own.

`bootstrap.sh` should contain the following code (replace string descriptors with your info):

`
`export CDK_DEFAULT_ACCOUNT="your account number"`
`export CDK_DEFAULT_REGION="choose a default region"`
`export AWS_DEFAULT_ACCOUNT="your account number"`
`export AWS_DEFAULT_REGION="choose a default region"`
`export AWS_ACCESS_KEY_ID="your IAM user access key"`
`export AWS_SECRET_ACCESS_KEY="your secret access key"`

`cdk bootstrap`
`

`deploy.sh` should contain the following code:

`
`export AWS_DEFAULT_ACCOUNT="your account number"`
`export AWS_DEFAULT_REGION="choose a default region"`
`export AWS_ACCESS_KEY_ID="your IAM user access key"`
`export AWS_SECRET_ACCESS_KEY="your secret access key"`

`cdk deploy`
`

This temporarily provides the environment of the shell with the variables/values necessary to execute each command. Both the `CDK` and `AWS` account/region keys are needed for the bootstrap, because the `env` property of the stack instantiation config object uses the `CDK` values. However, I haven't tested removing that and letting it rely completely on the shell environment during the bootstrap process yet, maybe we can remove the `env` config object and also the `CDK` keys from the bash file.

# General Notes / Concerns

1. Warning: If bootstrapping or deployment fails and rolls back automatically, you may still need to manually empty and delete the s3 bucket created by the bootstrap from the AWS console before trying again.

2. See other various notes for other concerns in index.ts (outdated addon versions, etc.)

# Known Bugs

1. Role/permissions issues

[a] Warning during bootstrap:

"current credentials could not be used to assume 'arn:aws:iam::535002886351:role/cdk-hnb659fds-lookup-role-535002886351-us-west-1', but are for the right account. Proceeding anyway."

[b] Probably related: got a warning on the AWS EKS console when looking at the cluster, signed in as my IAM user (assigned to a group that has the full AdministratorAccess permissions policy):

"Your current IAM principal doesn’t have access to Kubernetes objects on this cluster.

This may be due to the current user or role not having Kubernetes RBAC permissions to describe cluster resources or not having an entry in the cluster’s auth config map."

Seems like it may expect me to set up some sort of auth config during bootstrapping (possibly as a AWS Auth Config file)? For now, I have to sign in as my root user to view EKS cluster resources, but it has not caused any problems / there has been no need to do so yet.

2. Bug when deleting EKS Cluster Stack from AWS Cloud Formation console: "The following resource(s) failed to delete: [FargateClusterCoreDnsComputeTypePatch711BF1B2]." Does not prevent deleting everything else, though.
