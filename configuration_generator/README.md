<img src="https://raw.githubusercontent.com/unilogs/unilogs/refs/heads/main/configuration_generator/logo.png" width="400" alt="Unilogs logo">

# Unilogs shipper

## Prerequisites

- You must have Docker running.
- You must have already deployed the Unilogs platform, because you will need the
  addresses of the Kafka bootstrap brokers as well as the TLS certificate in
  order to connect securely.

## Instructions

1. `npx @unilogs/unilogs-shipper@latest`
2. Follow the steps in the application.
   - The `service_name` will be available as a label in Grafana.
   - Note that the "path to logs" supports globbing. Also, the working directory
     for relative paths will be wherever you are when you start creating the
     shipper. (Example valid path: `./logs/*.log`)
   - Paste in the Kafka bootstrap servers string and Kafka TLS certificate
     string exactly as they are given in the output of deploying the Unilogs
     platform.

## Advanced Usage

Custom transformations:

1. Follow the normal instructions dictated above.
2. Edit the generated `vector-shipper.yaml` to your preference.
3. Run `npx @unilogs/unilogs-shipper@latest` again.
4. Choose the redeploy option.
5. Check Docker to ensure your container is running. If it is, everything is OK.
   If not, repeat from step 2.

## Details

![Diagram of Unilogs shipper process](./shipper-process.drawio.svg)
