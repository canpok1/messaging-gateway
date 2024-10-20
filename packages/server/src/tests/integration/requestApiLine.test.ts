import { createApp } from "@/App";
import { createNopLogger } from "@/Logger";
import { it } from "vitest";
import request from "supertest";
import { paths } from "@/types/api.gen";
import {
  cleanupRedisStream,
  createEnvForTest,
  createRedisClient,
  sleep,
} from "@/tests/utils";
import { WebhookMessageObject } from "@/types/api";

const logger = createNopLogger();
const streamPrefix = "test:line:webhook";

describe("POST /api/line/webhook/{channelId}/events", () => {
  type RequestBody =
    paths["/api/line/webhook/{channelId}/events"]["post"]["requestBody"]["content"]["application/json"];
  const channelId = "dummy-channel-id";
  const url = `/api/line/webhook/${channelId}/events`;
  const streamName = `${streamPrefix}:${channelId}`;

  describe("正常系(200)", () => {
    const env = createEnvForTest(streamPrefix);
    const redis = createRedisClient(env);

    afterEach(async () => {
      await cleanupRedisStream(env, channelId);
    });

    describe("イベントあり", () => {
      const requestBody: RequestBody = {
        destination: "dummy destination",
        events: ["dummy event 1", "dummy event 2"],
      };

      it("イベントを追加できる", async () => {
        const app = createApp(env, logger);

        const response = await request(app)
          .post(url)
          .set("x-line-signature", "dummy-signature")
          .send(requestBody);

        expect.soft(response.status).toBe(200);
        expect.soft(response.body).toEqual({});

        const messageCount = await redis.xlen(streamName);
        expect.soft(messageCount).toEqual(1);
      });
    });
  });

  describe("異常系（400）", () => {
    const env = createEnvForTest(streamPrefix);

    describe("リクエストヘッダーなし（x-line-signature）", () => {
      it("ステータスコード400", async () => {
        const dummyRequest: RequestBody = {
          destination: "dummy destination",
          events: ["dummy event 1", "dummy event 2"],
        };

        const app = createApp(env, logger);

        const response = await request(app).post(url).send(dummyRequest);

        expect.soft(response.status).toBe(400);
        expect.soft(response.body).toHaveProperty("message");
      });
    });
  });

  describe("異常系（500）", async () => {
    describe("redis不通", () => {
      const env = createEnvForTest(streamPrefix, { redisHost: "unknown-host" });

      it("ステータスコード500", async () => {
        const dummyRequest: RequestBody = {
          destination: "dummy destination",
          events: ["dummy event 1", "dummy event 2"],
        };
        const app = createApp(env, logger);

        const response = await request(app)
          .post(url)
          .set("x-line-signature", "dummy-signature")
          .send(dummyRequest);

        expect.soft(response.status).toBe(500);
        expect.soft(response.body).toHaveProperty("message");
      });
    });
  });
});

describe("GET /api/line/webhook/{channelId}/messages/new", () => {
  describe("正常系（200）", () => {
    const env = createEnvForTest(streamPrefix);
    const redis = createRedisClient(env);
    const channelId = "dummy-channel-id";
    const url = `/api/line/webhook/${channelId}/messages/new`;
    const streamName = `${streamPrefix}:${channelId}`;

    afterEach(async () => {
      await cleanupRedisStream(env, channelId);
    });

    describe("ストリームなし", () => {
      it("取得結果は空", async () => {
        const app = createApp(env, logger);

        const response = await request(app)
          .get(url)
          .query({ consumer: "dummy-consumer" });

        expect.soft(response.status).toBe(200);
        expect.soft(response.body).toEqual({ messages: [] });
      });
    });

    describe("未配信メッセージあり", () => {
      const consumer = "consumer";
      const messageId = "12345-1";
      const message: WebhookMessageObject = {
        requestId: "dummy-id",
        signature: "dummy-signature",
        destination: "dummy-destination",
        events: [{ key: "value" }],
      };

      beforeEach(async () => {
        await redis.xadd(
          streamName,
          messageId,
          "message",
          JSON.stringify(message)
        );
      });

      it("取得結果に未配信メッセージが含まれる", async () => {
        const app = createApp(env, logger);

        const response = await request(app).get(url).query({ consumer });

        expect.soft(response.status).toBe(200);
        expect(response.body).toHaveProperty("messages");
        expect(response.body.messages).toHaveLength(1);
        expect(response.body.messages[0]).toMatchObject(message);
      });
    });

    describe("配信済みメッセージあり", () => {
      const consumer = "consumer";
      const messageId = "12345-1";
      const message: WebhookMessageObject = {
        requestId: "dummy-id",
        signature: "dummy-signature",
        destination: "dummy-destination",
        events: [{ key: "value" }],
      };

      beforeEach(async () => {
        await redis.xadd(
          streamName,
          messageId,
          "message",
          JSON.stringify(message)
        );
        await redis.xgroup("CREATE", streamName, env.redisGroupNameForLine, 0);
        await redis.xreadgroup(
          "GROUP",
          env.redisGroupNameForLine,
          consumer,
          "STREAMS",
          streamName,
          ">"
        );
      });

      describe("処理時間は最大以内", () => {
        const maxIdleTimeMs = 60 * 60 * 1000; // 最大を超えないよう長めに設定

        it("配信先コンシューマによる取得結果は空（自身で処理中のメッセージは取得対象外）", async () => {
          const app = createApp(env, logger);

          const response = await request(app).get(url).query({
            consumer,
            max_count: 2,
            max_idle_time_ms: maxIdleTimeMs,
            max_delivery_count: 2,
          });

          expect.soft(response.status).toBe(200);
          expect(response.body).toHaveProperty("messages");
          expect(response.body.messages).toHaveLength(0);
        });

        it("他コンシューマによる取得結果は空（他で処理中で最大時間を超えてないメッセージは取得対象外）", async () => {
          const otherConsumer = consumer + "_other";
          const app = createApp(env, logger);

          const response = await request(app).get(url).query({
            consumer: otherConsumer,
            max_count: 2,
            max_idle_time_ms: maxIdleTimeMs,
            max_delivery_count: 2,
          });

          expect.soft(response.status).toBe(200);
          expect(response.body).toHaveProperty("messages");
          expect(response.body.messages).toHaveLength(0);
        });
      });
      describe("処理時間は最大超過", () => {
        const maxIdleTimeMs = 1;

        beforeEach(async () => {
          // 最大時間を超えるよう少し待機
          await sleep(maxIdleTimeMs * 5);
        });
        it("配信先コンシューマによる取得結果に処理中メッセージは含まれない（自身で処理中で最大時間超過したメッセージは取得対象外）", async () => {
          const app = createApp(env, logger);

          const response = await request(app).get(url).query({
            consumer: consumer,
            max_count: 2,
            max_idle_time_ms: maxIdleTimeMs,
            max_delivery_count: 2,
          });

          expect.soft(response.status).toBe(200);
          expect(response.body).toHaveProperty("messages");
          expect(response.body.messages).toHaveLength(0);
        });

        it("他コンシューマによる取得結果に処理中メッセージが含まれる（他で処理中だが最大時間超過したメッセージは取得対象）", async () => {
          const otherConsumer = consumer + "_other";
          const app = createApp(env, logger);

          const response = await request(app).get(url).query({
            consumer: otherConsumer,
            max_count: 2,
            max_idle_time_ms: maxIdleTimeMs,
            max_delivery_count: 2,
          });

          expect.soft(response.status).toBe(200);
          expect(response.body).toHaveProperty("messages");
          expect(response.body.messages).toHaveLength(1);
          expect(response.body.messages[0]).toMatchObject(message);
        });
      });
    });

    describe("再配信済みのメッセージあり", () => {
      const consumer = "consumer";
      const messageId = "12345-1";
      const message: WebhookMessageObject = {
        requestId: "dummy-id",
        signature: "dummy-signature",
        destination: "dummy-destination",
        events: [{ key: "value" }],
      };
      const deliveriedCount = 3;

      beforeEach(async () => {
        // メッセージを追加して自身で読み取り（配信数は1回）
        await redis.xadd(
          streamName,
          messageId,
          "message",
          JSON.stringify(message)
        );
        await redis.xgroup("CREATE", streamName, env.redisGroupNameForLine, 0);
        await redis.xreadgroup(
          "GROUP",
          env.redisGroupNameForLine,
          consumer,
          "STREAMS",
          streamName,
          ">"
        );
        // 指定の配信回数になるまで自身宛に再配信
        const maxIdleTimeMs = 1;
        for (let i = 0; i < deliveriedCount - 1; i++) {
          // 最大時間を超えるよう少し待機
          await sleep(maxIdleTimeMs * 5);

          await redis.xclaim(
            streamName,
            env.redisGroupNameForLine,
            consumer,
            maxIdleTimeMs,
            messageId
          );
        }
      });

      describe("処理時間も配信回数も最大超過", () => {
        const maxIdleTimeMs = 1;
        const maxDeliveryCount = deliveriedCount - 1;

        beforeEach(async () => {
          // 最大時間を超えるよう少し待機
          await sleep(maxIdleTimeMs * 5);
        });
        it("配信先コンシューマによる取得結果に処理中メッセージは含まれない（自身で処理中の最大時間も最大配信回数も超過したメッセージは取得対象外）", async () => {
          const app = createApp(env, logger);
          const response = await request(app).get(url).query({
            consumer: consumer,
            max_count: 2,
            max_idle_time_ms: maxIdleTimeMs,
            max_delivery_count: maxDeliveryCount,
          });

          expect.soft(response.status).toBe(200);
          expect(response.body).toHaveProperty("messages");
          expect(response.body.messages).toHaveLength(0);
        });

        it("他コンシューマによる取得結果に処理中メッセージは含まれない（他で処理中の最大時間も最大配信回数も超過したメッセージは取得対象外）", async () => {
          const otherConsumer = consumer + "_other";

          const app = createApp(env, logger);
          const response = await request(app).get(url).query({
            consumer: otherConsumer,
            max_count: 2,
            max_idle_time_ms: maxIdleTimeMs,
            max_delivery_count: maxDeliveryCount,
          });

          expect.soft(response.status).toBe(200);
          expect(response.body).toHaveProperty("messages");
          expect(response.body.messages).toHaveLength(0);
        });
      });
    });

    describe("未配信メッセージと再配信済みメッセージあり", () => {
      const consumer = "consumer1";
      const deliveredMessage1: WebhookMessageObject = {
        messageId: "1111-1",
        requestId: "dummy-request-id",
        signature: "dummy-signature",
        destination: "dummy-destination",
        events: [{ key: "value" }],
      };
      const deliveredMessage2: WebhookMessageObject = {
        messageId: "1111-2",
        requestId: "dummy-request-id",
        signature: "dummy-signature",
        destination: "dummy-destination",
        events: [{ key: "value" }],
      };
      const undeliveredMessage1: WebhookMessageObject = {
        messageId: "2222-1",
        requestId: "dummy-request-id",
        signature: "dummy-signature",
        destination: "dummy-destination",
        events: [{ key: "value" }],
      };
      const undeliveredMessage2: WebhookMessageObject = {
        messageId: "2222-2",
        requestId: "dummy-request-id",
        signature: "dummy-signature",
        destination: "dummy-destination",
        events: [{ key: "value" }],
      };

      beforeEach(async () => {
        // メッセージを追加して他で読み取り
        await redis.xadd(
          streamName,
          deliveredMessage1.messageId,
          "message",
          JSON.stringify(deliveredMessage1)
        );
        await redis.xadd(
          streamName,
          deliveredMessage2.messageId,
          "message",
          JSON.stringify(deliveredMessage2)
        );
        await redis.xgroup("CREATE", streamName, env.redisGroupNameForLine, 0);
        await redis.xreadgroup(
          "GROUP",
          env.redisGroupNameForLine,
          consumer,
          "STREAMS",
          streamName,
          ">"
        );

        // メッセージを追加して配信しない
        await redis.xadd(
          streamName,
          undeliveredMessage1.messageId,
          "message",
          JSON.stringify(undeliveredMessage1)
        );
        await redis.xadd(
          streamName,
          undeliveredMessage2.messageId,
          "message",
          JSON.stringify(undeliveredMessage2)
        );
      });

      describe("処理時間が最大超過", () => {
        const maxIdleTimeMs = 1;

        beforeEach(async () => {
          // 最大時間を超えるよう少し待機
          await sleep(maxIdleTimeMs * 5);
        });

        it("配信先コンシューマによる取得結果が未配信のみ", async () => {
          const app = createApp(env, logger);
          const response = await request(app).get(url).query({
            consumer,
            max_count: 3,
            max_idle_time_ms: maxIdleTimeMs,
            max_delivery_count: 3,
          });

          expect.soft(response.status).toBe(200);
          expect(response.body).toHaveProperty("messages");
          expect(response.body.messages).toHaveLength(2);
          expect(response.body.messages).toEqual([
            undeliveredMessage1,
            undeliveredMessage2,
          ]);
        });

        it("他コンシューマによる取得結果が最大時間超過の再配信済→未配信の順", async () => {
          const otherConsumer = consumer + "_other";
          const app = createApp(env, logger);
          const response = await request(app).get(url).query({
            consumer: otherConsumer,
            max_count: 3,
            max_idle_time_ms: maxIdleTimeMs,
            max_delivery_count: 3,
          });

          expect.soft(response.status).toBe(200);
          expect(response.body).toHaveProperty("messages");
          expect(response.body.messages).toHaveLength(3);
          expect(response.body.messages).toEqual([
            deliveredMessage1,
            deliveredMessage2,
            undeliveredMessage1,
          ]);
        });
      });
    });
  });

  describe("異常系（400）", () => {
    const env = createEnvForTest(streamPrefix);
    const channelId = "dummy-channel-id";

    describe("必須のクエリパラメータ（consumer）不足", () => {
      const url = `/api/line/webhook/${channelId}/messages/new`;

      it("ステータスコード400", async () => {
        const app = createApp(env, logger);
        const response = await request(app).get(url);

        expect.soft(response.status).toBe(400);
        expect(response.body).toHaveProperty("message");
      });
    });
  });

  describe("異常系（500）", () => {
    const channelId = "dummy-channel-id";
    const url = `/api/line/webhook/${channelId}/messages/new`;
    const consumer = "consumer";

    describe("Redis不通", () => {
      const env = createEnvForTest(streamPrefix, { redisHost: "unknown-host" });

      it("ステータスコード500", async () => {
        const app = createApp(env, logger);
        const response = await request(app).get(url).query({
          consumer,
        });

        expect.soft(response.status).toBe(500);
        expect(response.body).toHaveProperty("message");
      });
    });
  });
});

describe("DELETE /api/line/webhook/{channelId}/messages/{messageId}", () => {
  const channelId = "dummy-channel-id";
  const existingMessageId = "1111-1";
  const streamName = `${streamPrefix}:${channelId}`;

  describe("正常系（200）", () => {
    const env = createEnvForTest(streamPrefix);
    const redis = createRedisClient(env);
    const consumer = "consumer";

    afterEach(async () => {
      await cleanupRedisStream(env, channelId);
    });

    describe("自身への配信済みメッセージあり", () => {
      beforeEach(async () => {
        await redis.xadd(
          streamName,
          existingMessageId,
          "message",
          JSON.stringify({})
        );
        await redis.xgroup("CREATE", streamName, env.redisGroupNameForLine, 0);
        await redis.xreadgroup(
          "GROUP",
          env.redisGroupNameForLine,
          consumer,
          "STREAMS",
          streamName,
          ">"
        );
      });

      it("メッセージが削除される", async () => {
        const url = `/api/line/webhook/${channelId}/messages/${existingMessageId}`;
        const app = createApp(env, logger);

        const response = await request(app).delete(url);

        expect.soft(response.status).toBe(200);
        expect.soft(response.body).toEqual({});

        const messageCount = await redis.xlen(streamName);
        expect.soft(messageCount).toEqual(0);
      });
    });
  });

  describe("異常系(404)", () => {
    const env = createEnvForTest(streamPrefix);
    const redis = createRedisClient(env);
    const nonexistentMessageId = "1111-2";
    const url = `/api/line/webhook/${channelId}/messages/${nonexistentMessageId}`;

    describe("ストリームなし", () => {
      it("ステータスコード404", async () => {
        const app = createApp(env, logger);

        const response = await request(app).delete(url);

        expect.soft(response.status).toBe(404);
        expect(response.body).toHaveProperty("message");
      });
    });

    describe("グループなし", () => {
      beforeEach(async () => {
        await redis.xadd(
          streamName,
          existingMessageId,
          "message",
          JSON.stringify({})
        );
      });

      afterEach(async () => {
        await cleanupRedisStream(env, channelId);
      });

      it("ステータスコード404", async () => {
        const app = createApp(env, logger);

        const response = await request(app).delete(url);

        expect.soft(response.status).toBe(404);
        expect(response.body).toHaveProperty("message");
      });
    });

    describe("メッセージなし", () => {
      beforeEach(async () => {
        await redis.xadd(
          streamName,
          existingMessageId,
          "message",
          JSON.stringify({})
        );
        await redis.xgroup("CREATE", streamName, env.redisGroupNameForLine, 0);
      });

      afterEach(async () => {
        await cleanupRedisStream(env, channelId);
      });

      it("ステータスコード404", async () => {
        const app = createApp(env, logger);

        const response = await request(app).delete(url);

        expect.soft(response.status).toBe(404);
        expect(response.body).toHaveProperty("message");
      });
    });
  });

  describe("異常系(500)", () => {
    const nonexistentMessageId = "1111-2";
    const url = `/api/line/webhook/${channelId}/messages/${nonexistentMessageId}`;

    describe("Redis不通", () => {
      const env = createEnvForTest(streamPrefix, { redisHost: "unknown-host" });

      it("ステータスコード500", async () => {
        const app = createApp(env, logger);

        const response = await request(app).delete(url);

        expect.soft(response.status).toBe(500);
        expect(response.body).toHaveProperty("message");
      });
    });
  });
});
