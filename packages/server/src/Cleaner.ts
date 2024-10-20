import { Env } from "@/Env";
import { Logger } from "@/Logger";
import { createRedisClientByEnv, RedisClient, RedisRawMessage } from "@/Redis";

export class MessageCleaner {
  private redis: RedisClient;

  constructor(
    private env: Env,
    private consumer: string,
    private minIdleTime: number,
    private batchSize: number
  ) {
    this.redis = createRedisClientByEnv(env, "dummy-channel-id");
  }

  async clean(logger: Logger) {
    logger.info("start clean all stream");

    await this.redis.eachStream(async (streamName: string) => {
      const childLogger = logger.child({ streamName });
      await this.cleanByStream(childLogger, streamName);
    });

    logger.info("end clean all stream");
  }

  async cleanByStream(logger: Logger, streamName: string) {
    logger.info(`check stream [${streamName}]`);
    const rawMessages = await this.redis.autoClaim(
      streamName,
      this.consumer,
      this.minIdleTime,
      this.batchSize
    );
    for (const rawMessage of rawMessages) {
      const childLogger = logger.child({ ...rawMessage });
      await this.cleanByMessage(childLogger, rawMessage);
    }
  }

  async cleanByMessage(logger: Logger, rawMessage: RedisRawMessage) {
    await this.redis.ackMessage(rawMessage.messageId);
    await this.redis.deleteMessage(rawMessage.messageId);
    logger.error(`deleted unhandled message [${rawMessage.messageId}]`);
  }
}
