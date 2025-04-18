# How to test deployment

## Jest testing

A small test suite is available to ensure core components of the stack would still be there before spending time on a full deploy where a deployment error and rollback can take a long time.

Run `npm test` to check if stack is ready for deployment.

## Full/manual testing

Step 1: run `npm install`

Step 2: run `npm run dev` (or `npm run build:deploy` to test deployment using build output) and fill in your details (you can skip the session token if you're not using one)

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
