import { Env } from "@/Env";
import { v4 as uuidv4 } from "uuid";
import type { WebhookMessageObject } from "@/types/api";
import { RequestDataParser } from "@/Request";
import { RedisClient } from "@/Redis";
import { paths } from "@/types/api.gen";
import { Request, Response } from "express";
import { Logger } from "@/Logger";

type GetResponse =
  paths["/api/line/webhook/messages/new"]["get"]["responses"]["200"]["content"]["application/json"];

export async function GET(
  env: Env,
  parentLogger: Logger,
  req: Request,
  res: Response
) {
  const requestId = uuidv4();
  const logger = parentLogger.child({ requestId });

  const params = new RequestDataParser(req);

  const consumer = params.getQueryParamAsString("consumer");
  const maxCount = params.getQueryParamAsNumberOrUndefined("max_count") || 0;
  const maxIdleTimeMs =
    params.getQueryParamAsNumberOrUndefined("max_idle_time_ms") || 60000;
  const maxDeliveryCount =
    params.getQueryParamAsNumberOrUndefined("max_delivery_count") || 3;
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

  const resObj: GetResponse = { messages };
  res.status(200).json(resObj);
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
    env.redisStreamNameForLine,
    env.redisGroupNameForLine
  );
  logger.debug("make redis client", {
    redisHost: env.redisHost,
    redisPort: env.redisPort,
    redisStreamName: env.redisStreamNameForLine,
    redisGroupName: env.redisGroupNameForLine,
    consumer,
  });

  const entriesCount = await client.countStreamEntries();
  if (entriesCount === 0) {
    return [];
  }

  const created = await client.createConsumerGroupIfNotExists();
  if (created) {
    logger.debug(`created consumer group ${env.redisGroupNameForLine}`);
  } else {
    logger.debug(
      `skiped created consumer group ${env.redisGroupNameForLine}, group is exists`
    );
  }

  const longPendingMessages = await client.readLongPendingMessages(
    logger,
    consumer,
    maxIdleTimeMs,
    maxCount,
    maxDeliveryCount
  );
  logger.debug("read long pending messages", { longPendingMessages });

  if (maxCount && longPendingMessages.length >= maxCount) {
    return longPendingMessages;
  }

  const readNewMessagesMaxCount = Math.max(
    maxCount - longPendingMessages.length,
    0
  );

  const newMessages = await client.readNewMessages(
    logger,
    consumer,
    readNewMessagesMaxCount
  );
  logger.debug("read new messages", { newMessages });

  return longPendingMessages.concat(newMessages);
}
