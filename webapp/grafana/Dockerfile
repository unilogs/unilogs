FROM grafana/grafana:latest
WORKDIR /
COPY ./datasources.yaml /etc/grafana/provisioning/datasources/datasources.yaml
COPY ./dashboards /etc/grafana/provisioning/dashboards
COPY ./grafana.ini /etc/grafana/grafana.ini
EXPOSE 3000