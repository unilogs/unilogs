# Deployment Prerequisites and Process

I bootstrapped and deployed the cluster in a bash shell. To do this, I added a `.gitignore` file that ignores two bash files: `bootstrap.sh` and `deploy.sh`. You will need to create your own.

`bootstrap.sh` should contain the following code (replace string descriptors with your info):

`
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

This temporarily provides the environment of the shell with the variables/values necessary to execute each command.

# General Notes / Concerns

1. Warning: If bootstrapping fails and rolls back automatically, you also need to manually empty and delete the s3 bucket created by the bootstrap from the AWS console before trying again. Same goes for after deleting the bootstrap CDK stack manually.

2. See other various notes for other concerns in index.ts

3. File is messy and should be refactored once functional

# Known Bugs

## IAM user unable to view cluster resources

You get a warning on the AWS EKS console when looking at the cluster, signed in as the IAM user who created the cluster. (assigned to a group that has the full AdministratorAccess permissions policy):

"Your current IAM principal doesn’t have access to Kubernetes objects on this cluster.

This may be due to the current user or role not having Kubernetes RBAC permissions to describe cluster resources or not having an entry in the cluster’s auth config map."

We should figure out how to set access up properly during initial CDK deployment. This will require properly creating IAM roles/permissions, and setting them in the rbac and service account config settings during deployment.

However, there is a manual fix for now, although it takes a little while to do.

### Manual (post-deployment) fix using the AWS EKS console and CloudShell

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

## Loki backend pods not scheduled by Fargate

All three of the Loki backend pods, "loki-backend-<0, 1, or 2>", have a Warning event with a "FailedScheduling" reason.

Message: "Pod not supported on Fargate: volumes not supported: data not supported because: PVC data-loki-backend-<0, 1, or 2> not bound"

This implies we will have to use a regular node group instead of Fargate, at least for the backend pods. However, a mixed cluster may be more complex than desirable.

## Errors with the three loki read pods

Type: Warning
	
Reason: BackOff
	
Message: Back-off restarting failed container loki in pod loki-read-<id number>(df7a1fa9-a5fb-4d55-8944-4e47942b7637) [the pod id number?]

This implies that the read pods are repeatedly crashing, maybe because the backend pods aren't scheduled.

## Grafana error?

I thought for sure I saw somewhere (maybe when looking at the "grafana-release-<id number>" pod) that I saw an event warning stating that after a few successful things, it failed the health check, because the connection was refused. It also gave an error for the logging, saying the logging was not set up / configured. But for some reason when I look back at the pod I don't see any events.

Also, related, we will either need to schedule the Grafana pod as a load balancer service, accessible from outside the cluster, or as the default ClusterIP service, internally accessible only (either using the default nginx ingress controller or perhaps from an extra AWS EC2 instance, which could also serve as the hub for our UI if we want).
