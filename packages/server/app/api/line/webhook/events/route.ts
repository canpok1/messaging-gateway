export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { webhook } from "@line/bot-sdk";
import { Env } from "@/utils/Env";
import { createLogger } from "@/utils/Logger";
import { v4 as uuidv4 } from "uuid";

import type { ErrorObject } from "@/types/api";
import { RedisClient, WebhookStreamObject } from "@/utils/Redis";

const HEADER_SIGNATURE = "x-line-signature";

export async function POST(req: NextRequest) {
  const requestId = uuidv4();
  const env = new Env(process.env);
  const logger = createLogger(env, { requestId });
  try {
    let signature: string = undefined;
    for (const pair of req.headers.entries()) {
      if (pair[0].toLocaleString() === HEADER_SIGNATURE) {
        signature = pair[1];
      }
    }
    if (!signature) {
      const errObj: ErrorObject = {
        message: `not found required header[${HEADER_SIGNATURE}]`,
      };
      return NextResponse.json(errObj, { status: 400 });
    }

    const body = (await req.json()) as webhook.CallbackRequest;
    logger.info("received request", { signature, body });

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

    return NextResponse.json({}, { status: 200 });
  } catch (err) {
    const msg = "internal server error";
    logger.error(msg, { message: err });
    const errObj: ErrorObject = { message: msg };
    return NextResponse.json(errObj, { status: 500 });
  }
}
