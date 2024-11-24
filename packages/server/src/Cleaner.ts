import { Env } from "@/Env";
import { Logger } from "@/Logger";
import { createRedisClientByEnv, RedisClient, RedisRawMessage } from "@/Redis";

export class MessageCleaner {
  constructor(
    private env: Env,
    private consumer: string,
    private minIdleTime: number,
    private batchSize: number
  ) {}

  async clean(logger: Logger) {
    logger.info("start clean all stream");

    const redis = createRedisClientByEnv(this.env, "dummy-channel-id");
    try {
      await redis.eachStream(async (streamName: string) => {
        const childLogger = logger.child({ streamName });
        await this.cleanByStream(childLogger, redis, streamName);
      });

      logger.info("end clean all stream");
    } finally {
      await redis.disconnect();
    }
  }

  async cleanByStream(logger: Logger, redis: RedisClient, streamName: string) {
    logger.info(`check stream [${streamName}]`);
    const rawMessages = await redis.autoClaim(
      streamName,
      this.consumer,
      this.minIdleTime,
      this.batchSize
    );
    for (const rawMessage of rawMessages) {
      const childLogger = logger.child({ ...rawMessage });
      await this.cleanByMessage(childLogger, redis, rawMessage);
    }
  }

  async cleanByMessage(
    logger: Logger,
    redis: RedisClient,
    rawMessage: RedisRawMessage
  ) {
    await redis.ackMessage(rawMessage.messageId);
    await redis.deleteMessage(rawMessage.messageId);
    logger.error(`deleted unhandled message [${rawMessage.messageId}]`);
  }
}
