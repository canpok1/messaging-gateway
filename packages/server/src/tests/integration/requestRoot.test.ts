import { createApp } from "@/App";
import { createNopLogger } from "@/Logger";
import { it } from "vitest";
import request from "supertest";
import { createEnvForTest } from "@/tests/utils";

describe("GET /", () => {
  const logger = createNopLogger();
  const env = createEnvForTest("test:");

  it("正常系", async () => {
    const app = createApp(env, logger);

    const response = await request(app).get("/");

    expect.soft(response.status).toBe(200);
    expect(response.text).toEqual(`running ${env.appName}`);
  });
});
