# How to test deployment

Step 1: run `npm install`

## Dev testing with split bootstrap and deploy commands

Create a `bootstrap.sh` and `deploy.sh` file. Fill in your info as follows in each:

`export AWS_ACCESS_KEY_ID="<your key ID>"`
`export AWS_SECRET_ACCESS_KEY="<you secret access key>"`
`export AWS_DEFAULT_ACCOUNT="<your account number>"`
`export AWS_DEFAULT_REGION="<your default region>"`
`export AWS_USER_NAME="<your IAM username>"`

Followed by `cdk bootstrap` or `cdk deploy` as appropriate.

Run `bash bootstrap.sh`.

Then, run `bash deploy.sh`.

# Streamlined launch method (useable but very basic production style launch)

Run `bash launch.sh` after filling in your details.

# Original README Information

## Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

### Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template
