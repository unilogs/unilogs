## Build image

`docker build -t unilogs-shipper:latest .`

## Run image

`docker run --volume ./logs:/logs --name unilogs-shipper -d unilogs-shipper:latest`