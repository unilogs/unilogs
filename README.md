# unilogs

## Dev purposes:

- `aws eks update-kubeconfig --region region-code --name unilogs-cluster`
- Once Kafka is running, run this command to make sure kafka-tls exists: `kubectl get secrets -n kafka`
- Run this command to download the cert into your current working directory: `kubectl get secret kafka-tls -n kafka -o jsonpath='{.data.ca\.crt}' | base64 -d > ./ca.crt`
- Change `vector-shipper.yaml` to point towards your `data_dir`, `sinks.kafka.tls.ca_file` and `sources.app_logs.include`
- Run this command to run your vector shipper: `vector --config /<YOUR PATH>/unilogs/apacheLogger/vector-shipper.yaml`
