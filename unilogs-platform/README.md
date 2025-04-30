<img src="https://raw.githubusercontent.com/unilogs/unilogs/refs/heads/main/configuration_generator/logo.png" width="400" alt="Unilogs logo" />

# Welcome to the Unilogs platform

## Preqrequisites

- A (non-root) IAM user with admin permissions to deploy the stack.
- User's access key.
- User's secret access key.

## Instructions

- Run: `npm run build:deploy`
  - Follow the prompts

## To destroy

Either:

- Go to AWS console and delete the stack from `CloudFormation`
- Or, if you have the `aws` cli installed:
  - Authanticate through `aws configure`
    - Run `cdk destroy`
    - If something goes wrong while destroying the stack:
      - Go to your AWS console, remove the associated resources from:
        - CloudFormation
        - VPC
        - EKS
        - EC2
          - Note: (If a `network interface` is still in use you'll have to remove a `load balancer` first)
