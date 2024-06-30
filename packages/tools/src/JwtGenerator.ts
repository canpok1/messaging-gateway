import { generateJwt } from "../../lib/src/Line";
import * as fs from "fs";

(async () => {
  const channelId = process.argv[2];
  const privateKeyFile = process.argv[3];
  const privateKey = fs.readFileSync(privateKeyFile, "utf-8");
  const kid = process.argv[4];
  const tokenExpSec = 60 * 60 * 24 * 30;

  const jwt = await generateJwt(channelId, privateKey, kid, tokenExpSec);

  console.log("channelId: ", channelId);
  console.log("privateKeyFile: ", privateKeyFile);
  console.log("kid: ", kid);
  console.log("tokenExpSec: ", tokenExpSec);
  console.log("jwt: ", jwt);
})();
