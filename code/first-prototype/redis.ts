import Redis from "ioredis";

const publisher = new Redis({ host: "redis" });
const subscriber = new Redis({ host: "redis" });

subscriber.subscribe("test");

subscriber.on("messageBuffer", (channel, message) => {
  console.log("Received message:", message);
});

setInterval(() => {
  publisher.publish("test", Buffer.from("Hello, world!"));
}, 1000);
