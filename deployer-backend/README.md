# Deployment Prerequisites and Process

I bootstrapped and deployed the cluster in a bash shell. To do this, I added a `.gitignore` file that ignores two bash files: `bootstrap.sh` and `deploy.sh`. You will need to create your own.

`bootstrap.sh` and `deploy.sh` should each contain the following code:

`export AWS_DEFAULT_ACCOUNT="your account number"`
`export AWS_DEFAULT_REGION="choose a default region"`
`export AWS_ACCESS_KEY_ID="your IAM user access key"`
`export AWS_SECRET_ACCESS_KEY="your secret access key"`
`export USER_NAME="the deploying user's username"`

`cdk bootstrap` OR `cdk deploy`

This temporarily provides the environment of the shell with the variables/values necessary to execute each command.

# General Notes / Concerns

1. See comments in index.ts for considerations not on this list.

2. File is messy and should be refactored once functional

3. Note: If bootstrapping fails and rolls back automatically, you also need to manually empty and delete the s3 bucket created by the bootstrap from the AWS console before trying again. Same goes for after deleting the bootstrap CDK stack manually.

4. Deployment is set up to give IAM user who deploys the stack admin access. However, best practice is to assign admin access based on a role, which may be assumed conditionally by various users. This, though, means requiring they assume a custom role we create, or else we need to know what existing role they want the access policies added to.

5. We will either need to schedule the Grafana pod as a load balancer service, accessible from outside the cluster, or as the default ClusterIP service, internally accessible only (either using the default nginx ingress controller or perhaps the AWS load balancer controller). I haven't yet been able to access a working grafana server, so I'm not sure if setting it as the LoadBalancer makes sense or even works yet.

6. At this time, when deploying the test cluster with no helm charts, all pods run without permanent problems. However, when trying to deploy the app onto the cluster with this directory's deployment, there are errors.

7. This deployment's cluster is set up such that it starts with a CDK-defined node group, but it has the necessary permissions preset to allow you to turn on EKS Auto Mode in the AWS EKS console. However, they recommend you remove and reinstall any components when you do that, so I don't think it's useful in this case where the helm charts have already been installed, hence the initial node group set up.

## Accessing the cluster with kubectl

If you want to interact with the cluster with command line tools, you'll need to establish a connection with kubectl.

How to do that in the AWS CloudShell console:
1. While signed in as the IAM user that deployed the cluster, open up AWS CloudShell.
2. Run `aws eks update-kubeconfig --name <cluster-name> --region <region>` to connect to cluster and set it as context for kubectl.
  -if credentials weren't inferred automatically by CloudShell, may need to first run `aws configure` and provide session keys and default region. You can skip the default output format. (Alternatively, you can export the keys to the environment.)
3. Verify credential config with `aws sts get-caller-identity` - should return your IAM user.
4. Verify access to the cluster with `kubectl get nodes` if you like, or move to next step.

If you want to change the ConfigMap, you can then:
1. Run `kubectl get configmap aws-auth -n kube-system -o yaml > aws-auth.yaml` to copy the aws-auth ConfigMap for the cluster to a yaml file.
2. Edit `aws-auth.yaml` with `sudo nano aws-auth.yaml`
3. Finally, apply the new aws-auth ConfigMap with `kubectl apply -f aws-auth.yaml`

# Known Bugs

## Loki backend pods and grafana pod not scheduled

All three of the Loki backend pods, "loki-backend-<0, 1, or 2>", fail scheduling because they make PVCs without any nodes/volumes available. Same with the grafana pod.

## Loki read pods creashing

Type: Warning
	
Reason: BackOff
	
Message: Back-off restarting failed container loki in pod loki-read-<id number>(df7a1fa9-a5fb-4d55-8944-4e47942b7637) [the pod id number?]

This implies that the read pods are repeatedly crashing, maybe because the backend pods aren't scheduled.
