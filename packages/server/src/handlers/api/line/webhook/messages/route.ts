import { Env } from "@/Env";
import { v4 as uuidv4 } from "uuid";
import { RequestDataParser } from "@/Request";
import { createRedisClientByEnv } from "@/Redis";
import { Request, Response } from "express";
import { Logger } from "@/Logger";
import { NotFoundError } from "@/Error";

export async function DELETE(
  env: Env,
  parentLogger: Logger,
  req: Request,
  res: Response
) {
  const requestId = uuidv4();
  const logger = parentLogger.child({ requestId });

  const params = new RequestDataParser(req);

  const channelId = params.getPathParamAsString("channelId");
  const messageId = params.getPathParamAsString("messageId");

  logger.info("received request", {
    channelId,
    messageId,
  });

  await deleteMessages(env, logger, channelId, messageId);

  res.status(200).json({});
}

async function deleteMessages(
  env: Env,
  logger: Logger,
  channelId: string,
  messageId: string
): Promise<void> {
  const client = createRedisClientByEnv(env, channelId);
  logger.debug("make redis client", {
    redisHost: env.redisHost,
    redisPort: env.redisPort,
    redisStreamPrefix: env.redisStreamPrefixForLine,
    channelId,
    redisGroupName: env.redisGroupNameForLine,
  });

  const ackedCount = await client.ackMessage(messageId);
  if (ackedCount === 0) {
    throw new NotFoundError("message not found when ack");
  }
  logger.debug("acked message", { messageId });

  const deletedCount = await client.deleteMessage(messageId);
  if (deletedCount === 0) {
    throw new NotFoundError("message not found when delete");
  }
  logger.debug("deleted message", { messageId });

  return;
}
