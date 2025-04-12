# unilogs

## Dev purposes:

- `aws eks update-kubeconfig --region region-code --name my-cluster`
- `eksctl create addon --name aws-ebs-csi-driver --cluster unilogs-cluster --region region-code`

Once Kafka is running, run this command to make sure kafka-tls exists : kubectl get secrets -n kafka

Run this command to download the cert into your current working directory kubectl get secret kafka-tls -n kafka -o jsonpath='{.data.ca\.crt}' | base64 -d > ./ca.crt

Change vector-shipper.yaml  to connect to your data_dir and sources.app_logs.include
`vector --config /<YOUR PATH>/unilogs/apacheLogger/vector-shipper.yaml`
