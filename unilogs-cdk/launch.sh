export AWS_ACCESS_KEY_ID="<your key ID>"
export AWS_SECRET_ACCESS_KEY="<you secret access key>"
export AWS_DEFAULT_ACCOUNT="<your account number>"
export AWS_DEFAULT_REGION="<your default region>"
export USER_NAME="<deploying user's AWS IAM username>"

cdk bootstrap && cdk deploy
