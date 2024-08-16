import { EncryptedValue, SecretString } from "@messaging-gateway/lib";
import { readFileSync } from "fs";

(async () => {
  const inputText = readFileSync(process.stdin.fd, "utf8");
  const password = new SecretString(process.env.ENCRYPTION_PASSWORD || "");
  const encrypted = EncryptedValue.makeFromPlainText(inputText, password);

  console.log(encrypted.serialize());
})();
