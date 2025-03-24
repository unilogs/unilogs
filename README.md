# unilogs
1. Start Kafka, Vector Consumer, Loki, Grafana UI with docker compose up -d.
2. Kafka Monitor app can be used to monitor that Kafka server is online and what data is entering into the message queue.
3. After verifying Kafka server is running, run each logger app and then run docker compose up -d for the vector shippers for each app.