# Installation instructions

1. Put the `docker-compose.yml` and `fluent-bit.conf` files in the directory
   containing the directory that contains the logs.
2. It expects that the logs will be in a file named `app.log` in a directory
   called `logs`. If not, you will need to edit the `volumes:` definition in
   the `fluent-bit.conf` file as follows:
   `./logs:/logs` -> `./foo:/logs` (assuming the new directory is "foo")
   And/or you will need to edit the expected filename in `fluent-bit.conf`:
   `Path          /logs/app.log` -> `Path          /logs/foo.log` (assuming the
   new filename is "foo.log")
3. For now, it expects the ingester to be on the same machine
   (`host.docker.internal`).
4. Then simply `docker compose up` and FluentBit will start streaming to
   localhost:8080.
