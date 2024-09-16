import { type WebhookStreamObject } from "@messaging-gateway/lib";
import { createClient, type RedisClientType } from "redis";

export type Id = string;

export class RedisClient {
  private streamName: string;
  private client: RedisClientType;

  constructor(host: string, port: number, streamName: string) {
    const url = `redis://${host}:${port}`;
    console.log(`url: ${url}`);
    this.client = createClient({ url: url });
    this.streamName = streamName;
  }

  private async withConnection<T>(func: () => Promise<T>): Promise<T> {
    if (!this.client.isReady) {
      await this.client.connect();
    }

    try {
      return await func();
    } finally {
      await this.client.quit();
    }
  }

  async addWebhookStreamObject(object: WebhookStreamObject): Promise<Id> {
    return await this.withConnection(async () => {
      return await this.client.xAdd(this.streamName, "*", object);
    });
  }
}
