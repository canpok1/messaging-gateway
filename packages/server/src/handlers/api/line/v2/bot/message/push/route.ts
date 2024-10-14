import {
  EncryptedValue,
  generateJwt,
  issueChannelAccessToken,
} from "@messaging-gateway/lib";
import { PrismaClient } from "@prisma/client";
import { messagingApi, HTTPFetchError } from "@line/bot-sdk";
import { v4 as uuidv4 } from "uuid";
import { Env } from "@/Env";
import { Logger } from "@/Logger";
import { ErrorObject } from "@/types/api";
import express from "express";

export async function POST(
  env: Env,
  parentLogger: Logger,
  req: express.Request,
  res: express.Response
) {
  const requestId = uuidv4();
  const logger = parentLogger.child({ requestId });

  const channelId = req.get("X-MessagingGateway-Line-Channel-Id");
  const body = req.body as messagingApi.PushMessageRequest;

  logger.info("received request", { channelId, body });

  if (!channelId) {
    const errObj: ErrorObject = {
      message: "X-MessagingGateway-Line-Channel-Id is empty or not exists",
    };
    res.status(400).json(errObj);
    return;
  }

  const childLogger = logger.child({ channelId });
  const resObj = await sendMessage(env, channelId, body, childLogger);
  if (typeof resObj === "string") {
    const errObj: ErrorObject = { message: resObj };
    res.status(400).json(errObj);
  } else {
    childLogger.info("success to send message");
    res.status(200).json(resObj);
  }
}

async function sendMessage(
  env: Env,
  channelId: string,
  body: messagingApi.PushMessageRequest,
  logger: Logger
): Promise<messagingApi.PushMessageResponse | string> {
  const prisma = new PrismaClient();
  const lineChannel = await prisma.line_channels.findUnique({
    where: {
      id: channelId,
    },
  });
  if (!lineChannel) {
    logger.error("failed to find lineChannel, channel is not found");
    return `channel(id=${channelId}) is not found`;
  }
  logger.debug("found lineChannel record");

  const encryptedSecretKey = EncryptedValue.makeFromSerializedText(
    lineChannel.encrypted_secret_key
  );

  const secretKey = encryptedSecretKey.decrypt(env.encryptionPassword);
  logger.debug("decrypted secret key");

  const kid = lineChannel.kid;
  const tokenExpSec = 60 * 1;
  const jwt = await generateJwt(channelId, secretKey.value(), kid, tokenExpSec);
  logger.debug("generated jwt");

  let accessToken: string;
  try {
    const result = await issueChannelAccessToken(jwt);
    accessToken = result.accessToken;
  } catch (err) {
    let msg = "failed to issue channel access token";
    if (err instanceof HTTPFetchError) {
      try {
        const body = JSON.parse(err.body);
        msg += `, ${body.error}(${body.error_description})`;
      } catch (err) {
        logger.warn("failed to parse response", { message: err });
      }
    }
    logger.error(msg, { message: err });
    return msg;
  }
  logger.debug("issued channel access token");

  const client = new messagingApi.MessagingApiClient({
    channelAccessToken: accessToken,
  });
  try {
    return await client.pushMessage(body);
  } catch (err) {
    let msg = "failed to push message";
    try {
      if (err instanceof HTTPFetchError) {
        const body = JSON.parse(err.body) as messagingApi.ErrorResponse;
        for (const detail of body.details) {
          msg += `, ${detail.message}(${detail.property})`;
        }
      }
    } catch (err) {
      logger.warn("failed to parse response", { message: err });
    }

    logger.error(msg, { message: err });
    return msg;
  }
}
