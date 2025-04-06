# Vector shipper configuration generator and runner

## Starting

1. `npm install`
2. `npm start`

## Instructions

- You must add a source and transform, sink, and map from the source/transform
  to the sink.
- Save the vector_shipper.yaml, Save the Dockerfile.
- Finally Docker build and run the shipper.

### Hints

- Add source and transform
  - The "service" input will be used to label logs from the source.
  - The path to logs can contain wildcards and be relative or absolute. E.g.
    `./logs/*.log`
  - Currently only Apache and plain text logs are supported, but we'll add
    others soon.
- Add sink
  - Loki sink
    - The endpoint is the domain (e.g. `https://logs-prod-036.grafana.net`)
    - The path is the rest of URL (e.g. `/loki/api/v1/push`)