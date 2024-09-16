import { WebhookMessageObject } from "@/types/api";
import { Redis } from "ioredis";
import { webhook } from "@line/bot-sdk";
import { Logger } from "winston";

export type Id = string;

export type WebhookStreamObject = {
  requestId: string;
  signature: string;
  destination: string;
  events: webhook.Event[];
};

export class RedisClient {
  private streamName: string;
  private groupName: string;
  private client: Redis;

  constructor(
    host: string,
    port: number,
    streamName: string,
    groupName: string
  ) {
    this.client = new Redis({
      host,
      port,
    });
    this.streamName = streamName;
    this.groupName = groupName;
  }

  async addWebhookStreamObject(object: WebhookStreamObject): Promise<Id> {
    return await this.client.xadd(
      this.streamName,
      "*",
      "message",
      JSON.stringify(object)
    );
  }

  async createConsumerGroupIfNotExists(): Promise<boolean> {
    try {
      await this.client.xgroup("CREATE", this.streamName, this.groupName, 0);
      return true;
    } catch (err) {
      if (err instanceof Error && err.message.includes("BUSYGROUP")) {
        return false;
      }
      throw err;
    }
  }

  async readNewMessages(
    logger: Logger,
    consumerName: string,
    maxCount: number
  ): Promise<WebhookMessageObject[]> {
    const result = await this.client.xreadgroup(
      "GROUP",
      this.groupName,
      consumerName,
      "STREAMS",
      this.streamName,
      ">"
    );
    if (!result) {
      logger.debug("result of readNewMessages is empty");
      return [];
    }
    logger.debug("result of readNewMessages is not empty");

    const [_stream, messages] = result[0] as [
      string,
      Array<[string, Array<string>]>
    ];

    const messageObjects: WebhookMessageObject[] = [];
    for (const [messageId, fields] of messages) {
      const childLogger = logger.child({ messageId });
      try {
        const value = this.findValue(fields, "message");
        const message = JSON.parse(value) as WebhookStreamObject;
        messageObjects.push({
          messageId: messageId,
          requestId: message.requestId,
          signature: message.signature,
          destination: message.destination,
          events: JSON.stringify(message.events),
        });
      } catch (err) {
        childLogger.error(err);
      }
    }

    return messageObjects;
  }

  async readLongPendingMessages(
    logger: Logger,
    consumerName: string,
    maxIdleTimeMs: number,
    maxCount: number,
    maxDeliveryCount: number
  ): Promise<WebhookMessageObject[]> {
    const messages: WebhookMessageObject[] = [];

    let shouldContinue = true;
    let begin = "-";
    const end = "+";
    while (shouldContinue) {
      const pendingMessages = await this.xpending(
        maxIdleTimeMs,
        begin,
        end,
        10
      );
      logger.debug(`pendingMessages count: ${pendingMessages.length}`);
      if (pendingMessages.length === 0) {
        shouldContinue = false;
      }

      for (const pendingMessage of pendingMessages) {
        begin = "(" + pendingMessage.messageId;
        if (pendingMessage.consumer === consumerName) {
          continue;
        }
        if (pendingMessage.deliveryCount >= maxDeliveryCount) {
          continue;
        }

        const message = await this.xclaim(
          consumerName,
          maxIdleTimeMs,
          pendingMessage.messageId
        );
        messages.push(message);
        if (messages.length >= maxCount) {
          shouldContinue = false;
          break;
        }
      }
    }

    return messages;
  }

  private async xpending(
    maxIdleTimeMs: number,
    begin: string,
    end: string,
    count: number
  ): Promise<{ messageId: string; consumer: string; deliveryCount: number }[]> {
    const result = (await this.client.xpending(
      this.streamName,
      this.groupName,
      "IDLE",
      maxIdleTimeMs,
      begin,
      end,
      count
    )) as Array<unknown[]>;

    return result.map((msg) => ({
      messageId: msg[0] as string,
      consumer: msg[1] as string,
      deliveryCount: msg[3] as number,
    }));
  }

  private async xclaim(
    consumerName: string,
    maxIdleTimeMs: number,
    messageId: string
  ): Promise<WebhookMessageObject> {
    const result = await this.client.xclaim(
      this.streamName,
      this.groupName,
      consumerName,
      maxIdleTimeMs,
      messageId
    );
    const fields = result[0][1] as string[];
    const value = this.findValue(fields, "message");
    return JSON.parse(value);
  }

  private findValue(fields: string[], key: string): string {
    for (let index = 0; index < fields.length; index++) {
      if (fields[index] === key) {
        return fields[index + 1];
      }
    }
    throw new Error(`key[${key}] is not found in redis message`);
  }
}
