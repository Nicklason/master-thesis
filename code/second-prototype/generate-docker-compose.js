const fs = require("fs");
const YAML = require("yaml");

const graph = require("./graph.js");

const services = {};

graph.vertexMap.forEach((vertex) => {
  const outEdges = graph.outgoingEdgesOf(vertex.key);

  services[`redis-${vertex.key}`] = {
    image: "redis:alpine",
    container_name: `redis-${vertex.key}`,
    ports: [6379],
    volumes: [`./data/redis-${vertex.key}:/data`],
  };

  services[`connector-${vertex.key}`] = {
    image: "connector",
    container_name: `connector-${vertex.key}`,
    volumes: [`./data/connector-${vertex.key}:/data`],
    environment: {
      NODE_ID: vertex.key,
      CONNECTED_NODES: outEdges.map((edge) => edge.dest).join(","),
    },
  };
});

const dockerCompose = {
  version: "3",
  services,
};

fs.writeFileSync("docker-compose.yml", YAML.stringify(dockerCompose));
