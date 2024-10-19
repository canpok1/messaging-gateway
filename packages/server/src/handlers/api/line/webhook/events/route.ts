import { webhook } from "@line/bot-sdk";
import { v4 as uuidv4 } from "uuid";
import type { ErrorObject } from "@/types/api";
import { RedisClient, WebhookStreamObject } from "@/Redis";
import express from "express";
import { Env } from "@/Env";
import { Logger } from "@/Logger";
import { RequestDataParser } from "@/Request";

const HEADER_SIGNATURE = "x-line-signature";

export async function POST(
  env: Env,
  parentLogger: Logger,
  req: express.Request,
  res: express.Response
) {
  const requestId = uuidv4();
  const logger = parentLogger.child({ requestId });

  const params = new RequestDataParser(req);

  const channelId = params.getPathParamAsString("channelId");
  const signature: string = req.get(HEADER_SIGNATURE);
  if (!signature) {
    const errObj: ErrorObject = {
      message: `not found required header[${HEADER_SIGNATURE}]`,
    };
    res.status(400).json(errObj);
    return;
  }

  const body = req.body as webhook.CallbackRequest;
  logger.info("received request", { signature, body });

  const client = new RedisClient(
    env.redisHost,
    env.redisPort,
    env.redisStreamPrefixForLine,
    channelId,
    env.redisGroupNameForLine
  );
  logger.debug("make redis client", {
    redisHost: env.redisHost,
    redisPort: env.redisPort,
    redisStreamName: env.redisStreamPrefixForLine,
  });

  const streamObj: WebhookStreamObject = {
    requestId,
    signature,
    destination: body.destination,
    events: body.events,
  };
  logger.debug("make webhook stream object", { streamObj });

  const id = await client.addWebhookStreamObject(streamObj);
  logger.info("added webhookStreamObject", { id });

  res.status(200).json({});
}
