import { createApp } from "@/App";
import { createNopLogger } from "@/Logger";
import { it } from "vitest";
import request from "supertest";
import { createEnvParamFromProcessEnv, Env } from "@/Env";
import { paths } from "@/types/api.gen";
import { cleanupRedisStream, createRedisClient } from "./utils";
import { v4 as uuidv4 } from "uuid";

function createEnv(): Env {
  const env = createEnvParamFromProcessEnv(process.env);
  env.redisStreamNameForLine = uuidv4();
  return env;
}

const logger = createNopLogger();
const env = createEnv();
const redis = createRedisClient(env);

afterEach(async () => {
  await cleanupRedisStream(env);
});

it("POST /api/line/webhook/events", async () => {
  type RequestBody =
    paths["/api/line/webhook/events"]["post"]["requestBody"]["content"]["application/json"];

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
