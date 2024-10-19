import express from "express";
import { Env } from "@/Env";
import { POST as postMessage } from "@/handlers/api/line/v2/bot/message/push/route";
import { POST as postEvent } from "@/handlers/api/line/webhook/events/route";
import { GET as getNewMessage } from "@/handlers/api/line/webhook/messages/new/route";
import { DELETE as deleteMessage } from "@/handlers/api/line/webhook/messages/route";
import { Logger } from "@/Logger";
import { handleError } from "./handlers/error";

export function createApp(env: Env, logger: Logger): express.Express {
  const app = express();

  app.use(express.json());

  app.get("/", (_req, res, next) => {
    try {
      res.send(`running ${env.appName}`);
    } catch (err) {
      next(err);
    }
  });
  app.post("/api/line/v2/bot/message/push", async (req, res, next) => {
    try {
      await postMessage(env, logger, req, res);
    } catch (err) {
      next(err);
    }
  });
  app.post("/api/line/webhook/:channelId/events", async (req, res, next) => {
    try {
      await postEvent(env, logger, req, res);
    } catch (err) {
      next(err);
    }
  });
  app.get(
    "/api/line/webhook/:channelId/messages/new",
    async (req, res, next) => {
      try {
        await getNewMessage(env, logger, req, res);
      } catch (err) {
        next(err);
      }
    }
  );
  app.delete(
    "/api/line/webhook/:channelId/messages/:messageId",
    async (req, res, next) => {
      try {
        await deleteMessage(env, logger, req, res);
      } catch (err) {
        next(err);
      }
    }
  );

  app.use((err, _req, res, _next) => {
    handleError(logger, err, res);
  });

  return app;
}
