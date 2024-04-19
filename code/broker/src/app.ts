import { Broker } from "./broker";

const broker = new Broker();

broker.start();

process.on("SIGTERM", async () => {
  await broker.stop();
});
