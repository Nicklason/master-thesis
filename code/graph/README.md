# Graphs

Scripts for generating things used for the network. This evolved from the second prototype and is used to set up the third prototype.

## Graph

The graph is manually created using the graph.ts file. This contains nodes and edges that are used by the other scripts.

## Docker

This will generate the docker compose manifest file used to start up the network and create volumes for each broker and populate it with a peers.json file which contains the host and port of each neighbouring node.

To use the script, run the following command:

```bash
ts-node genrate-compose.ts
```

## Certificates

A broker needs certificates. Certificates for each broker are generated using the generate-certs.ts file. This will generate a directory for each broker and generate the keys and certificates inside of it. It relies on openssl, so a Docker image was used to make sure openssl is present.

A directory called data needs to be added to this directory. It needs to contain two files, the private key of the CA, and the CA certificate:

* ca-cert.pem
* ca-key.pem

The docker compose also needs to be updated if the private key is passcode protected.

```bash
docker compose -f certs-compose.yaml run --build certs
```

This will generate the certificates in the certs folder.
