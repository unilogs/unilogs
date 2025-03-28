FROM timberio/vector:latest-distroless-static
ADD ./apache-remap.vrl /apache-remap.vrl
ADD ./plaintext-remap.vrl /plaintext-remap.vrl
ADD ./vector-shipper.yaml /etc/vector/vector.yaml
VOLUME /logs