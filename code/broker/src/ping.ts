import { Message } from "./messages/message";
import { MessageType } from "./messages/types";
import { MessageFactory } from "./messages/factory";
import { MessagePublisher, MessageSubscriber, Peer } from "./node/pubsub";

/**
 * Measure the latency between two nodes by sending a ping message and waiting for a pong.
 * @param publisher The publisher to send the ping message with.
 * @param subscriber The subscriber to listen for the pong message on.
 * @param ttl The time to wait for the pong message in milliseconds.
 * @returns The latency in nanoseconds.
 * @throws {Error} If the timeout is reached.
 */
export async function measureLatency(
  publisher: MessagePublisher & Peer,
  subscriber: MessageSubscriber,
  ttl = 1000,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const theirId = publisher.getId();
    if (theirId === null) {
      return reject(new Error("Publisher has no id"));
    }

    let start: bigint;

    const cleanup = () => {
      subscriber.off("message", listener);
      clearTimeout(timeout);
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Timeout reached while waiting for pong message"));
    }, ttl);

    const ping = MessageFactory.ping([theirId]);

    const listener = (_: number, raw: Buffer) => {
      if (start === undefined) {
        return;
      }

      const message = Message.decode(raw);
      if (message.type !== MessageType.PONG) {
        // Not a pong message
        return;
      } else if (
        message.payload.message_id !== ping.id &&
        message.payload.message_source !== ping.source
      ) {
        // Not a pong message to the ping
        return;
      }

      cleanup();

      const end = process.hrtime.bigint();

      // Should at max be one second because of the timeout so we can safely
      // cast it to a number
      const latency = Number(end - start);

      resolve(latency);
    };

    subscriber.on("message", listener);

    publisher.publish(ping).then(() => {
      start = process.hrtime.bigint();
    });
  });
}
