import { Broker } from "./broker";
import { HTTPServer } from "./http-server";

const broker = new Broker();
const server = new HTTPServer(broker);

(async () => {
  // First start the broker
  await broker.start();
  // Then start the HTTP server
  await server.start(8080);
})();

process.on("SIGTERM", async () => {
  // First stop the HTTP server
  await server.stop();
  // Then stop the broker
  await broker.stop();
  process.exit(0);
});
