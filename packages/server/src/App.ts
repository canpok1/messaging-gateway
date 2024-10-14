import express from "express";
import { Env } from "@/Env";
import { POST as postMessage } from "@/handlers/api/line/v2/bot/message/push/route";
import { POST as postEvent } from "@/handlers/api/line/webhook/events/route";
import { GET as getNewMessage } from "@/handlers/api/line/webhook/messages/new/route";
import { Logger } from "@/Logger";
import { handleError } from "./handlers/error";

export function createApp(env: Env, logger: Logger): express.Express {
  const app = express();

  app.use(express.json());

  app.get("/", (_req, res) => {
    res.send(`running ${env.appName}`);
  });
  app.post("/api/line/v2/bot/message/push", async (req, res) => {
    await postMessage(env, logger, req, res);
  });
  app.post("/api/line/webhook/events", async (req, res) => {
    await postEvent(env, logger, req, res);
  });
  app.get("/api/line/webhook/messages/new", async (req, res) => {
    await getNewMessage(env, logger, req, res);
  });

  app.use((err, _req, res, _next) => {
    handleError(env, logger, err, res);
  });

  return app;
}
