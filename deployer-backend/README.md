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

1. Warning: If bootstrapping fails and rolls back automatically, you also need to manually empty and delete the s3 bucket created by the bootstrap from the AWS console before trying again. Same goes for after deleting the bootstrap CDK stack manually.

2. See other various notes for other concerns in index.ts

3. File is messy and should be refactored once functional

# Known Bugs

## IAM user unable to view cluster resources

You get a warning on the AWS EKS console when looking at the cluster, signed in as the IAM user who created the cluster. (assigned to a group that has the full AdministratorAccess permissions policy):

"Your current IAM principal doesn’t have access to Kubernetes objects on this cluster.

This may be due to the current user or role not having Kubernetes RBAC permissions to describe cluster resources or not having an entry in the cluster’s auth config map."

We should figure out how to set access up properly during initial CDK deployment. However, there is a manual fix for now, although it takes a little while to do.

### Post-deployment fix using the AWS EKS console and CloudShell

You can grant access after deployment in two main steps.

#### First, add admin access to the cluster via the EKS API
1. In the EKS cluster, go to "Access", and click "Manage access". Change the authentication mode to "EKS API and ConfigMap".
2. In "Access" again, click "Create access entry" in the "IAM access entries" section.
3. Add an entry for the desired IAM user, of the "standard" type. Add both the "AmazonEKSClusterAdminPolicy" and "AmazonEKSAdminPolicy" to the entry.

#### Second, add access to cluster resources via the cluster's ConfigMap
1. While signed in as the IAM user that deployed the cluster, open up AWS CloudShell.
2. Run `aws eks update-kubeconfig --name <cluster-name> --region <region>` to connect to cluster and set it as context for kubectl.
  -if credentials weren't inferred automatically by CloudShell, may need to first run `aws configure` and provide session keys and default region. You can skip the default output format. (Alternatively, you can export the keys to the environment.)
3. Verify credential config with `aws sts get-caller-identity` - should return your IAM user.
4. Verify access to the cluster with `kubectl get nodes` if you like, or move to next step.
5. Run `kubectl get configmap aws-auth -n kube-system -o yaml > aws-auth.yaml` to copy the aws-auth ConfigMap for the cluster to a yaml file.
6. Edit `aws-auth.yaml` with `sudo nano aws-auth.yaml`, by adding details to the `mapUsers` property as follows:

```
data:
  mapUsers: |
    - userarn: arn:aws:iam::<YOUR_ACCOUNT_ID>:user/<YOUR_IAM_USER>
      username: <YOUR_IAM_USER>
      groups:
        - system:masters
```

7. Finally, apply the new aws-auth ConfigMap with `kubectl apply -f aws-auth.yaml`
8. You can now exit CloudShell, navigate to your cluster on AWS EKS, and view the resources! (Refresh if you're already there.)
