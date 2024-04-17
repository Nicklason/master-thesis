import { Broker } from "./broker";

const broker = new Broker();
broker.start().then(() => {
  console.log("Started broker");
});
