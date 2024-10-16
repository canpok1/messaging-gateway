import { createApp } from "@/App";
import { createNopLogger } from "@/Logger";
import { it } from "vitest";
import request from "supertest";
import { createEnvParamFromProcessEnv, Env } from "@/Env";
import { paths } from "@/types/api.gen";
import { cleanupRedisStream, createRedisClient } from "./utils";
import { v4 as uuidv4 } from "uuid";
import { WebhookMessageObject } from "@/types/api";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createEnv(): Env {
  const env = createEnvParamFromProcessEnv(process.env);
  env.redisStreamNameForLine = `test:${uuidv4()}`;
  return env;
}

const logger = createNopLogger();
const env = createEnv();
const redis = createRedisClient(env);

afterEach(async () => {
  await cleanupRedisStream(env);
});

describe("POST /api/line/webhook/events", () => {
  type RequestBody =
    paths["/api/line/webhook/events"]["post"]["requestBody"]["content"]["application/json"];

  it("正常系（200）", async () => {
    const requestBody: RequestBody = {
      destination: "dummy destination",
      events: ["dummy event 1", "dummy event 2"],
    };

    const app = createApp(env, logger);

    const response = await request(app)
      .post("/api/line/webhook/events")
      .set("x-line-signature", "dummy-signature")
      .send(requestBody)
      .expect(200);

    expect(response.body).toEqual({});

    const messageCount = await redis.xlen(env.redisStreamNameForLine);
    expect(messageCount).toEqual(1);
  });
});

describe("GET /api/line/webhook/messages/new", () => {
  describe("正常系（200）", () => {
    describe("ストリームなし", () => {
      it("取得したメッセージは空配列", async () => {
        const app = createApp(env, logger);

        const response = await request(app)
          .get("/api/line/webhook/messages/new")
          .query({ consumer: "dummy-consumer" })
          .expect(200);

        expect(response.body).toEqual({ messages: [] });
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
          env.redisStreamNameForLine,
          messageId,
          "message",
          JSON.stringify(message)
        );
      });

      it("未配信メッセージが取得できる", async () => {
        const app = createApp(env, logger);

        const response = await request(app)
          .get("/api/line/webhook/messages/new")
          .query({ consumer })
          .expect(200);

        expect(response.body).toHaveProperty("messages");
        expect(response.body.messages).toHaveLength(1);
        expect(response.body.messages[0]).toMatchObject(message);
      });
    });

    describe("自身に配信済みのメッセージあり", () => {
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
          env.redisStreamNameForLine,
          messageId,
          "message",
          JSON.stringify(message)
        );
        await redis.xgroup(
          "CREATE",
          env.redisStreamNameForLine,
          env.redisGroupNameForLine,
          0
        );
        await redis.xreadgroup(
          "GROUP",
          env.redisGroupNameForLine,
          consumer,
          "STREAMS",
          env.redisStreamNameForLine,
          ">"
        );
      });

      it("自身で処理中のメッセージは取得対象外", async () => {
        const app = createApp(env, logger);

        const response = await request(app)
          .get("/api/line/webhook/messages/new")
          .query({
            consumer,
            max_count: 2,
            max_idle_time_ms: 60 * 60 * 1000,
            max_delivery_count: 2,
          })
          .expect(200);

        expect(response.body).toHaveProperty("messages");
        expect(response.body.messages).toHaveLength(0);
      });

      it("他で処理中で最大時間を超えてないメッセージは取得対象外", async () => {
        const otherConsumer = consumer + "_other";
        const app = createApp(env, logger);

        const response = await request(app)
          .get("/api/line/webhook/messages/new")
          .query({
            consumer: otherConsumer,
            max_count: 2,
            max_idle_time_ms: 60 * 60 * 1000, // 最大を超えないよう長めに設定
            max_delivery_count: 2,
          })
          .expect(200);

        expect(response.body).toHaveProperty("messages");
        expect(response.body.messages).toHaveLength(0);
      });

      it("他で処理中だが最大時間超過したメッセージは取得対象", async () => {
        const otherConsumer = consumer + "_other";
        const maxIdleTimeMs = 1;

        // 最大時間を超えるよう少し待機
        await sleep(maxIdleTimeMs * 5);

        const app = createApp(env, logger);
        const response = await request(app)
          .get("/api/line/webhook/messages/new")
          .query({
            consumer: otherConsumer,
            max_count: 2,
            max_idle_time_ms: maxIdleTimeMs,
            max_delivery_count: 2,
          })
          .expect(200);

        expect(response.body).toHaveProperty("messages");
        expect(response.body.messages).toHaveLength(1);
        expect(response.body.messages[0]).toMatchObject(message);
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
          env.redisStreamNameForLine,
          messageId,
          "message",
          JSON.stringify(message)
        );
        await redis.xgroup(
          "CREATE",
          env.redisStreamNameForLine,
          env.redisGroupNameForLine,
          0
        );
        await redis.xreadgroup(
          "GROUP",
          env.redisGroupNameForLine,
          consumer,
          "STREAMS",
          env.redisStreamNameForLine,
          ">"
        );
        // 指定の配信回数になるまで自身宛に再配信
        const maxIdleTimeMs = 1;
        for (let i = 0; i < deliveriedCount - 1; i++) {
          // 最大時間を超えるよう少し待機
          await sleep(maxIdleTimeMs * 5);

          await redis.xclaim(
            env.redisStreamNameForLine,
            env.redisGroupNameForLine,
            consumer,
            maxIdleTimeMs,
            messageId
          );
        }
      });

      it("他で処理中の最大時間も最大配信回数も超過したメッセージは取得対象外", async () => {
        const otherConsumer = consumer + "_other";
        const maxIdleTimeMs = 1;

        // 最大時間を超えるよう少し待機
        await sleep(maxIdleTimeMs * 5);

        const app = createApp(env, logger);
        const response = await request(app)
          .get("/api/line/webhook/messages/new")
          .query({
            consumer: otherConsumer,
            max_count: 2,
            max_idle_time_ms: maxIdleTimeMs,
            max_delivery_count: deliveriedCount - 1,
          })
          .expect(200);

        expect(response.body).toHaveProperty("messages");
        expect(response.body.messages).toHaveLength(0);
      });
    });

    describe("未配信と他に再配信済みの両方のメッセージあり", () => {
      const consumer = "consumer1";
      const otherConsumer = "consumer2";
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
          env.redisStreamNameForLine,
          deliveredMessage1.messageId,
          "message",
          JSON.stringify(deliveredMessage1)
        );
        await redis.xadd(
          env.redisStreamNameForLine,
          deliveredMessage2.messageId,
          "message",
          JSON.stringify(deliveredMessage2)
        );
        await redis.xgroup(
          "CREATE",
          env.redisStreamNameForLine,
          env.redisGroupNameForLine,
          0
        );
        await redis.xreadgroup(
          "GROUP",
          env.redisGroupNameForLine,
          otherConsumer,
          "STREAMS",
          env.redisStreamNameForLine,
          ">"
        );

        // メッセージを追加して配信しない
        await redis.xadd(
          env.redisStreamNameForLine,
          undeliveredMessage1.messageId,
          "message",
          JSON.stringify(undeliveredMessage1)
        );
        await redis.xadd(
          env.redisStreamNameForLine,
          undeliveredMessage2.messageId,
          "message",
          JSON.stringify(undeliveredMessage2)
        );
      });

      it("他で処理中の最大時間超過→未配信の順にメッセージが取得できる", async () => {
        const maxIdleTimeMs = 1;

        // 最大時間を超えるよう少し待機
        await sleep(maxIdleTimeMs * 5);

        const app = createApp(env, logger);
        const response = await request(app)
          .get("/api/line/webhook/messages/new")
          .query({
            consumer,
            max_count: 3,
            max_idle_time_ms: maxIdleTimeMs,
            max_delivery_count: 3,
          })
          .expect(200);

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
