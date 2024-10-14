import { createApp } from "@/App";
import { createNopLogger } from "@/Logger";
import { it } from "vitest";
import request from "supertest";
import { Env } from "@/Env";

function createEnv(): Env {
  return {
    appName: "dummy-app-name",
    logLevel: "error",
    encryptionPassword: undefined,
    redisHost: "redis",
    redisPort: 6379,
    redisStreamNameForLine: "test:line:webhook",
    redisGroupNameForLine: "processor",
  };
}

describe("GET /", () => {
  it("正常系", async () => {
    const logger = createNopLogger();
    const env = createEnv();
    const app = createApp(env, logger);

    const response = await request(app).get("/").expect(200);

    expect(response.text).toEqual(`running ${env.appName}`);
  });
});
