import { MessageBuilder } from "./builder";
import {
  MessageType,
  MessagePayload,
  PayloadNotRequiredMessageType,
  PayloadRequiredMessageType,
  Message,
} from "./message";

export class MessageFactory {
  private static source: number;

  static setSource(source: number): void {
    this.source = source;
  }

  static create<T extends PayloadNotRequiredMessageType>(
    type: T,
  ): MessageBuilder<T>;
  static create<T extends PayloadRequiredMessageType>(
    type: T,
    payload: MessagePayload[T],
  ): MessageBuilder<T>;
  static create<T extends MessageType>(type: T, payload: any = null) {
    // @ts-expect-error - This is a hack to get around the fact that the type and payload are not being inferred correctly
    const builder = new MessageBuilder(type, payload);
    builder.setSource(this.source);
    return builder;
  }

  static ping(destinations?: number[]): Message<MessageType.PING> {
    const ping = this.create(MessageType.PING);

    if (destinations) {
      ping.setDestinations(destinations);
    }

    return ping.build();
  }

  static pong(
    messageId: String,
    messageSource: number,
  ): Message<MessageType.PONG> {
    return this.create(MessageType.PONG, {
      message_id: messageId,
      message_source: messageSource,
    }).setDestinations([messageSource]).build();
  }

  static serverHello(): Message<MessageType.SERVER_HELLO> {
    return this.create(MessageType.SERVER_HELLO).build();
  }

  static clientHello(): Message<MessageType.CLIENT_HELLO> {
    return this.create(MessageType.CLIENT_HELLO).build();
  }
}
