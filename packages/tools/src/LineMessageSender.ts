import { generateJwt, issueChannelAccessToken } from "@messaging-gateway/lib";
import * as fs from "fs";
import * as line from "@line/bot-sdk";

(async () => {
  const userId = process.argv[2] || "";
  const message: line.messagingApi.TextMessage = {
    type: "text",
    text: process.argv[3] || "",
  };

  const channelId = process.env.LINE_CHANNEL_ID || "";
  const privateKeyFile = process.env.LINE_PRIVATE_KEY_FILE || "";
  const privateKey = fs.readFileSync(privateKeyFile, "utf-8");
  const kid = process.env.LINE_KID || "";
  const tokenExpSec = 60 * 1;

  const jwt = await generateJwt(channelId, privateKey, kid, tokenExpSec);
  const { accessToken } = await issueChannelAccessToken(jwt);

  const client = new line.messagingApi.MessagingApiClient({
    channelAccessToken: accessToken,
  });

  const response = await client.pushMessage({
    to: userId,
    messages: [message],
  });

  console.log(response);
})();
