I maybe shouldn't have included in the commit two things which were created when I bootstrapped:
-the cdk.out directory
-the cdk.context.json file

You may want to delete those before executing bootstrap and deploy commands. We may also want to remove them from the repo for the future.

That said, here's some things you need to know to use this to deploy an EKS cluster:

1. I bootstrapped and deployed the cluster in a bash shell. To do this, I added a `.gitignore` file that ignores two bash files: `bootstrap.sh` and `deploy.sh`. You will need to create your own. They each contain the following code:

`export CDK_DEFAULT_ACCOUNT="your account number"`
`export CDK_DEFAULT_REGION="choose a default region"`
`export AWS_ACCESS_KEY_ID="your IAM user access key"`
`export AWS_SECRET_ACCESS_KEY="your secret access key"`

`cdk bootstrap` or `cdk deploy`, depending on the file

This temporarily provides the environment of the shell with the variables/values necessary to execute each command.

2. You will also need a `.env` file with the default account and default region variables, which are referenced during the cdk Stack instantiation within the `index.ts` code, near the end of the file.

3. I'm not entirely sure why, but my choice of default region did not work. I tried to choose `us-west-1` initially, but it created a `us-east-1` environment instead, so I went with it and deployed there. It's possible the name of the environment variables should be `AWS_DEFAULT_`...etc, rather than `CDK_DEFAULT...`. The AWS CDK documentation seems to use both without explaination, but it also seems like whatever is set in the code itself should take precedence, so I'm not sure what's going on there. Maybe it has something to do with the shell environment when the code executes `app.synth()` to create the CloudFormation template?
