import { execSync } from "child_process";
import graph from "./graph";
import fs from "fs";

// Loop through each vertex in the graph (each node)
graph.vertexMap.forEach((vertex) => {
  const id = vertex.key;

  const dataPath = `./data`;

  const path = `${dataPath}/volumes/broker-${id}`;

  // Create directory if it doesn't exist
  fs.mkdirSync(path, { recursive: true });

  // Remove existing files if they exist
  if (fs.existsSync(`${path}/ca-cert.pem`)) {
    fs.unlinkSync(`${path}/ca-cert.pem`);
  }
  if (fs.existsSync(`${path}/cert.pem`)) {
    fs.unlinkSync(`${path}/cert.pem`);
  }
  if (fs.existsSync(`${path}/key.pem`)) {
    fs.unlinkSync(`${path}/key.pem`);
  }

  // Copy CA certificate
  fs.copyFileSync(`${dataPath}/ca-cert.pem`, `${path}/ca-cert.pem`);

  execSync(
    `openssl req -new -nodes -out ${path}/broker.csr -keyout ${path}/key.pem -subj "/CN=${id}" -addext "subjectAltName=DNS:broker-${id},IP:127.0.0.1"`,
  );

  execSync(
    `openssl x509 -req -in ${path}/broker.csr -CA ${dataPath}/ca-cert.pem -CAkey ${dataPath}/ca-key.pem -CAcreateserial -out ${path}/cert.pem -days 365 -copy_extensions copyall --passin pass:${process.env.CA_PASS}`,
  );

  // Delete CSR file
  fs.unlinkSync(`${path}/broker.csr`);
});
