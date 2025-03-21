# Installation instructions

1. Put the `docker-compose.yml` and `vector-shipper.yaml` files in the directory
   containing the directory that contains the logs.
2. It expects that the logs will be in a file named `app.log` in a directory
   called `logs`. If not, you will need to edit the `volumes:` definition in
   the `vector-shipper.yaml` file as follows:
   `./logs:/logs` -> `./foo:/logs` (assuming the new directory is "foo")
   And/or you will need to edit the expected filename in `vector-shipper.yaml`:
   `Path          /logs/app.log` -> `Path          /logs/foo.log` (assuming the
   new filename is "foo.log")
3. For now, it expects both docker compose files to connect to the same network `unilogs-network`
4. Then simply `docker compose up -d` and Vector will start streaming to
   kafka running on broker:29092 
