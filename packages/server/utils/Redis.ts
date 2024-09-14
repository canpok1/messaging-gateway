import { type WebhookStreamObject } from "@/types/api";
import { SecretString } from "@messaging-gateway/lib";
import { createClient, type RedisClientType } from "redis";

export type Id = string;

export interface ConnectionSetting {
  username?: string;
  password?: SecretString;
  host: string;
  port: number;
}

export class RedisClient {
  private streamName: string;
  private client: RedisClientType;

  constructor(streamName: string, setting: ConnectionSetting) {
    const urlParams = ["redis://"];
    if (setting.username) {
      urlParams.push(setting.username);
      if (setting.password) {
        urlParams.push(setting.username);
      }
      urlParams.push("@");
    }
    urlParams.push(setting.host);
    urlParams.push(":" + setting.port);

    this.client = createClient({ url: urlParams.join("") });
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
