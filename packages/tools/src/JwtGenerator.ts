import { generateJwt } from "../../lib/src/Line";
import * as fs from "fs";

(async () => {
  const channelId = process.env.LINE_CHANNEL_ID || "";
  const privateKeyFile = process.env.LINE_PRIVATE_KEY_FILE || "";
  const privateKey = fs.readFileSync(privateKeyFile, "utf-8");
  const kid = process.env.LINE_KID || "";
  const tokenExpSec = 60 * 60 * 24 * 30;

  const jwt = await generateJwt(channelId, privateKey, kid, tokenExpSec);

  console.log("channelId: ", channelId);
  console.log("privateKeyFile: ", privateKeyFile);
  console.log("kid: ", kid);
  console.log("tokenExpSec: ", tokenExpSec);
  console.log("jwt: ", jwt);
})();
