import { v4 as uuidv4 } from "uuid";
import { createEnvForTest } from "./tests/utils";
import { RedisClient } from "./Redis";
import { Env } from "./Env";
import { createNopLogger } from "./Logger";

function createSubjectUnderTest(env: Env, channelId: string): RedisClient {
  return new RedisClient(
    env.redisHost,
    env.redisPort,
    env.redisStreamPrefixForLine,
    channelId,
    env.redisGroupNameForLine,
    1
  );
}

const logger = createNopLogger();

describe("RedisClient", () => {
  describe("addWebhookStreamObject", () => {
    describe("Redis不通", () => {
      const streamPrefix = "test:redis";
      const env = createEnvForTest(streamPrefix, { redisHost: "unknown-host" });
      const channelId = uuidv4();

      it("例外発生", async () => {
        const sut = createSubjectUnderTest(env, channelId);
        await expect(
          sut.addWebhookStreamObject({
            requestId: "dummy-id",
            signature: "dummy-signature",
            destination: "dummy-destination",
            events: [],
          })
        ).rejects.toThrow();
      });
    });
  });

  describe("createConsumerGroupIfNotExists", () => {
    describe("Redis不通", () => {
      const streamPrefix = "test:redis";
      const env = createEnvForTest(streamPrefix, { redisHost: "unknown-host" });
      const channelId = uuidv4();

      it("例外発生", async () => {
        const sut = createSubjectUnderTest(env, channelId);
        await expect(sut.createConsumerGroupIfNotExists()).rejects.toThrow();
      });
    });

    describe("readNewMessages", () => {
      describe("Redis不通", () => {
        const streamPrefix = "test:redis";
        const env = createEnvForTest(streamPrefix, {
          redisHost: "unknown-host",
        });
        const channelId = uuidv4();

        it("例外発生", async () => {
          const sut = createSubjectUnderTest(env, channelId);
          const [dummyConsumer, dummyMaxCount] = ["consumer", 10];

          await expect(
            sut.readNewMessages(logger, dummyConsumer, dummyMaxCount)
          ).rejects.toThrow();
        });
      });
    });

    describe("readLongPendingMessages", () => {
      describe("Redis不通", () => {
        const streamPrefix = "test:redis";
        const env = createEnvForTest(streamPrefix, {
          redisHost: "unknown-host",
        });
        const channelId = uuidv4();

        it("例外発生", async () => {
          const sut = createSubjectUnderTest(env, channelId);
          const [
            dummyConsumer,
            dummyMaxIdleTimeMs,
            dummyMaxCount,
            dummyMaxDeliveryCount,
          ] = ["consumer", 1000, 10, 3];

          await expect(
            sut.readLongPendingMessages(
              logger,
              dummyConsumer,
              dummyMaxIdleTimeMs,
              dummyMaxCount,
              dummyMaxDeliveryCount
            )
          ).rejects.toThrow();
        });
      });
    });

    describe("countStreamEntries", () => {
      describe("Redis不通", () => {
        const streamPrefix = "test:redis";
        const env = createEnvForTest(streamPrefix, {
          redisHost: "unknown-host",
        });
        const channelId = uuidv4();

        it("例外発生", async () => {
          const sut = createSubjectUnderTest(env, channelId);
          await expect(sut.countStreamEntries()).rejects.toThrow();
        });
      });
    });

    describe("deleteMessage", () => {
      describe("Redis不通", () => {
        const streamPrefix = "test:redis";
        const env = createEnvForTest(streamPrefix, {
          redisHost: "unknown-host",
        });
        const channelId = uuidv4();

        it("例外発生", async () => {
          const sut = createSubjectUnderTest(env, channelId);
          const dummyMessageId = "1111-1";
          await expect(sut.deleteMessage(dummyMessageId)).rejects.toThrow();
        });
      });
    });
  });
});
