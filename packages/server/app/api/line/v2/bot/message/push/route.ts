export const dynamic = "force-dynamic";

import {
  EncryptedValue,
  generateJwt,
  issueChannelAccessToken,
} from "@messaging-gateway/lib";
import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { messagingApi, HTTPFetchError } from "@line/bot-sdk";
import { Env } from "@/utils/Env";
import { createLogger, Logger } from "@/utils/Logger";
import { v4 as uuidv4 } from "uuid";

import type { ErrorObject } from "@/types/api";

export async function POST(req: NextRequest) {
  const requestId = uuidv4();
  const env = new Env(process.env);
  const logger = createLogger(env, { requestId });
  try {
    const channelId = req.headers.get("X-MessagingGateway-Line-Channel-Id");
    const body = (await req.json()) as messagingApi.PushMessageRequest;

    logger.info("received request", { channelId, body });

    if (!channelId) {
      const errObj: ErrorObject = {
        message: "X-MessagingGateway-Line-Channel-Id is empty or not exists",
      };
      return NextResponse.json(errObj, { status: 400 });
    }

    const childLogger = logger.child({ channelId });
    const res = await sendMessage(env, channelId, body, childLogger);
    if (typeof res === "string") {
      const errObj: ErrorObject = { message: res };
      return NextResponse.json(errObj, { status: 400 });
    } else {
      childLogger.info("success to send message");
      return NextResponse.json(res, { status: 200 });
    }
  } catch (err) {
    const msg = "internal server error";
    logger.error(msg, { message: err });
    const errObj: ErrorObject = { message: msg };
    return NextResponse.json(errObj, { status: 500 });
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
