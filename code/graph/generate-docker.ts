import fs from "node:fs";
import YAML from "yaml";
import graph from "./graph";

const services = {};
const volumes = {};

graph.vertexMap.forEach((vertex) => {
  const outEdges = graph.outgoingEdgesOf(vertex.key);

  const brokerServiceName = `broker-${vertex.key}`;

  services[brokerServiceName] = {
    image: "broker",
    container_name: brokerServiceName,
    volumes: [`./data/broker-${vertex.key}:/app/data`],
  };

  // Create peers.json file for broker
  const peers = outEdges.map((edge) => {
    return {
      host: `broker-${edge.dest}`,
      port: 8000,
    };
  });

  fs.mkdirSync(`./data/volumes/broker-${vertex.key}`, { recursive: true });

  fs.writeFileSync(
    `./data/volumes/broker-${vertex.key}/peers.json`,
    JSON.stringify(peers, null, 2),
  );
});

const dockerCompose = {
  version: "3",
  services,
  volumes,
};

fs.writeFileSync("docker-compose.yml", YAML.stringify(dockerCompose));
