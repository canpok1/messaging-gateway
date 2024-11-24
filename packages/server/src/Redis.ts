import { WebhookMessageObject } from "@/types/api";
import { Redis, ReplyError } from "ioredis";
import { webhook } from "@line/bot-sdk";
import { Logger } from "winston";
import { Env } from "@/Env";

export const MESSAGE_KEY = "message";

export type Id = string;

export type WebhookStreamObject = {
  requestId: string;
  signature: string;
  destination: string;
  events: webhook.Event[];
};

export type RedisRawMessage = {
  messageId: string;
  messageValue: string;
};

export function createRedisClientByEnv(
  env: Env,
  channelId: string
): RedisClient {
  return new RedisClient(
    env.redisHost,
    env.redisPort,
    env.redisStreamPrefixForLine,
    channelId,
    env.redisGroupNameForLine,
    env.redisMaxRetriesPerRequest
  );
}

export class RedisClient {
  private streamPrefix: string;
  private streamName: string;
  private groupName: string;
  private client: Redis;

  constructor(
    host: string,
    port: number,
    streamPrefix: string,
    channelId: string,
    groupName: string,
    maxRetriesPerRequest: number
  ) {
    this.client = new Redis({
      host,
      port,
      maxRetriesPerRequest,
    });

    // エラー情報が標準出力されないようにする
    this.client.on("error", (_err) => {});

    this.streamPrefix = streamPrefix;
    this.streamName = `${streamPrefix}:${channelId}`;
    this.groupName = groupName;
  }

  async addWebhookStreamObject(object: WebhookStreamObject): Promise<Id> {
    return await this.client.xadd(
      this.streamName,
      "*",
      MESSAGE_KEY,
      JSON.stringify(object)
    );
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
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
      "COUNT",
      maxCount,
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
        const value = this.findValue(fields, MESSAGE_KEY);
        const message = JSON.parse(value) as WebhookStreamObject;
        messageObjects.push({
          messageId: messageId,
          requestId: message.requestId,
          signature: message.signature,
          destination: message.destination,
          events: message.events,
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

        try {
          const message = await this.xclaim(
            consumerName,
            maxIdleTimeMs,
            pendingMessage.messageId
          );
          messages.push(message);
        } catch (err) {
          logger.warn("skip xclaim for redis pending message", {
            messageId: pendingMessage.messageId,
            message: err,
          });
        }
        if (maxCount && messages.length >= maxCount) {
          shouldContinue = false;
          break;
        }
      }
    }

    return messages;
  }

  async countStreamEntries(): Promise<number> {
    return await this.client.xlen(this.streamName);
  }

  async deleteMessage(messageId: string): Promise<number> {
    return await this.client.xdel(this.streamName, messageId);
  }

  async ackMessage(messageId: string): Promise<number> {
    return await this.client.xack(this.streamName, this.groupName, messageId);
  }

  async eachStream(
    callback: (streamName: string) => Promise<void>
  ): Promise<void> {
    let cursor = "0";

    while (true) {
      const [nextCursor, keys] = await this.client.scan(
        cursor,
        "MATCH",
        `${this.streamPrefix}:*`,
        "COUNT",
        "100",
        "TYPE",
        "stream"
      );
      for (const key of keys) {
        await callback(key);
      }

      if (nextCursor === "0") {
        break;
      }
      cursor = nextCursor;
    }
  }

  async autoClaim(
    streamName: string,
    consumer: string,
    minIdleTime: number,
    count: number
  ): Promise<RedisRawMessage[]> {
    try {
      const result = await this.client.xautoclaim(
        streamName,
        this.groupName,
        consumer,
        minIdleTime,
        "0-0",
        "COUNT",
        count
      );
      /*
      取得結果は次の形式。２つ目の要素が再割り当てされたメッセージ。
      1) "1728895288510-0"
      2) 1) 1) "1728891713419-0"
            2) 1) "message"
               2) "value"
         2) 1) "1728893217213-0"
            2) 1) "message"
               2) "value"
         3) 1) "1728895085887-0"
            2) 1) "message"
               2) "value"
      3) (empty array)
      */
      const claimedMessages = result[1] as unknown[];

      const messages: RedisRawMessage[] = [];

      for (const claimedMessage of claimedMessages) {
        const messageId = claimedMessage[0] as string;
        const fields = claimedMessage[1] as string[];
        const value = this.findValue(fields, MESSAGE_KEY);
        messages.push({ messageId, messageValue: value });
      }

      return messages;
    } catch (err) {
      if (err instanceof ReplyError && err.message.includes("NOGROUP")) {
        return [];
      }
      throw err;
    }
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
