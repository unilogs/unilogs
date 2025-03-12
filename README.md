# unilogs

## Using Docker for Development

### Getting started

1. `docker compose up`
2. That's all. You should now have a TimescaleDB running on port 5469.

### Accessing TimescaleDB

- From the command line: `psql -h localhost -p 5469 -U postgres -d postgres`
- From within an app, please use the connection strings provided in the `.env`
  files. The reason for this is that on your local machine you can find the
  database at `localhost` but once everything is running in a container you
  will find it by its "service name" (`timescaledb`). Using environment
  variables makes it so you don't have to worry about that.
