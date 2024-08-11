import {
  EncryptedValue,
  generateJwt,
  issueChannelAccessToken,
  SecretString,
} from "@messaging-gateway/lib";
import { PrismaClient } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { messagingApi } from "@line/bot-sdk";

const encryptionPassword = new SecretString(
  process.env.ENCRYPTION_PASSWORD || ""
);

export async function POST(req: NextRequest) {
  const channelId = req.headers.get("X-MessagingGateway-Line-Channel-Id");
  const body = (await req.json()) as messagingApi.PushMessageRequest;

  console.log("received request: " + JSON.stringify({ channelId, body: body }));

  try {
    const res = await sendMessage(channelId, body);
    console.log(res);
    return NextResponse.json(res, { status: 200 });
  } catch (err) {
    if (err instanceof Error) {
      return NextResponse.json({ message: err.message }, { status: 400 });
    } else {
      return NextResponse.json(
        { message: "internal server error" },
        { status: 500 }
      );
    }
  }
}

async function sendMessage(
  channelId: string,
  body: messagingApi.PushMessageRequest
): Promise<messagingApi.PushMessageResponse> {
  const prisma = new PrismaClient();
  const lineChannel = await prisma.line_channels.findUnique({
    where: {
      id: channelId,
    },
  });
  if (!lineChannel) {
    console.log(
      `failed to find lineChannel, channel(id=${channelId}) is not found`
    );
    throw new Error(`channel(id=${channelId}) is not found`);
  }
  console.log(`found lineChannel, id=${channelId}`);

  const encryptedSecretKey = EncryptedValue.makeFromSerializedText(
    lineChannel.encrypted_secret_key
  );

  const secretKey = encryptedSecretKey.decrypt(encryptionPassword);
  console.log(`decrypted secret key: ${secretKey.value()}`);

  const kid = lineChannel.kid;
  const tokenExpSec = 60 * 1;
  const jwt = await generateJwt(channelId, secretKey.value(), kid, tokenExpSec);
  console.log("generated jwt: " + jwt);

  let accessToken: string;
  try {
    const result = await issueChannelAccessToken(jwt);
    accessToken = result.accessToken;
  } catch (err) {
    console.log(err);
    throw new Error("failed to issue channel access token");
  }
  console.log("accessToken:" + accessToken);

  const client = new messagingApi.MessagingApiClient({
    channelAccessToken: accessToken,
  });
  try {
    return await client.pushMessage(body);
  } catch (err) {
    console.log(err);
    throw new Error("failed to push message");
  }
}
