import { NextRequest, NextResponse } from "next/server";
import { Env } from "@/utils/Env";
import { createLogger } from "@/utils/Logger";
import { v4 as uuidv4 } from "uuid";

import type { ErrorObject, WebhookMessageObject } from "@/types/api";
import { RequestParam, RequestParamError } from "@/utils/Request";
import { RedisClient } from "@/utils/Redis";
import { paths } from "@/types/api.gen";
import { Logger } from "winston";

const HEADER_SIGNATURE = "x-line-signature";

type GetResponse =
  paths["/api/line/webhook/messages/new"]["get"]["responses"]["200"]["content"]["application/json"];

export async function GET(req: NextRequest) {
  const requestId = uuidv4();
  const env = new Env(process.env);
  const logger = createLogger(env, { requestId });

  const params = new RequestParam(req.nextUrl.searchParams);
  try {
    const consumer = params.getRequiredStringValue("consumer");
    const maxCount = params.getNumberValue("max_count");
    const maxIdleTimeMs = params.getNumberValue("max_idle_time_ms") || 60000;
    const maxDeliveryCount = params.getNumberValue("max_delivery_count") || 3;
    logger.info("received request", {
      consumer,
      maxCount,
      maxIdleTimeMs,
      maxDeliveryCount,
    });

    const messages = await readMessages(
      env,
      logger,
      consumer,
      maxCount,
      maxIdleTimeMs,
      maxDeliveryCount
    );

    const res: GetResponse = { messages };
    return NextResponse.json(res, { status: 200 });
  } catch (err) {
    if (err instanceof RequestParamError) {
      const errObj: ErrorObject = { message: err.message };
      return NextResponse.json(errObj, { status: 400 });
    }

    logger.error(err);
    const errObj: ErrorObject = { message: "internal server error" };
    return NextResponse.json(errObj, { status: 500 });
  }
}

async function readMessages(
  env: Env,
  logger: Logger,
  consumer: string,
  maxCount: number,
  maxIdleTimeMs: number,
  maxDeliveryCount: number
): Promise<WebhookMessageObject[]> {
  const client = new RedisClient(
    env.redisHost,
    env.redisPort,
    env.redisStreamName,
    env.redisGroupName
  );
  logger.debug("make redis client", {
    redisHost: env.redisHost,
    redisPort: env.redisPort,
    redisStreamName: env.redisStreamName,
    redisGroupName: env.redisGroupName,
    consumer,
  });

  const created = await client.createConsumerGroupIfNotExists();
  if (created) {
    logger.debug(`created consumer group ${env.redisGroupName}`);
  } else {
    logger.debug(
      `skiped created consumer group ${env.redisGroupName}, group is exists`
    );
  }

  const newMessages = await client.readNewMessages(logger, consumer, maxCount);
  logger.debug("read new messages", { newMessages });

  if (newMessages.length >= maxCount) {
    return newMessages;
  }

  const longPendingMessages = await client.readLongPendingMessages(
    logger,
    consumer,
    maxIdleTimeMs,
    maxCount - newMessages.length,
    maxDeliveryCount
  );
  logger.debug("read long pending messages", { longPendingMessages });

  return newMessages.concat(longPendingMessages);
}
