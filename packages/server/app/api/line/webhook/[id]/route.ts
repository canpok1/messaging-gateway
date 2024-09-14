import { NextRequest, NextResponse } from "next/server";
import { messagingApi } from "@line/bot-sdk";
import { Env } from "@/utils/Env";
import { createLogger } from "@/utils/Logger";
import { v4 as uuidv4 } from "uuid";

import type { ErrorObject } from "@/types/api";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const requestId = uuidv4();
  const env = new Env(process.env);
  const logger = createLogger(env, { requestId });
  try {
    const body = (await req.json()) as messagingApi.PushMessageRequest;

    logger.info("received request", { id: params.id, body });

    return NextResponse.json(
      {
        id: params.id,
      },
      { status: 200 }
    );
  } catch (err) {
    const msg = "internal server error";
    logger.error(msg, { err });
    const errObj: ErrorObject = { message: msg };
    return NextResponse.json(errObj, { status: 500 });
  }
}
