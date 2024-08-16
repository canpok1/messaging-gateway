import { EncryptedValue, SecretString } from "@messaging-gateway/lib";
import { readFileSync } from "fs";

(async () => {
  const inputText = readFileSync(process.stdin.fd, "utf8");
  const encrypted = EncryptedValue.makeFromSerializedText(inputText);
  const password = new SecretString(process.env.ENCRYPTION_PASSWORD || "");
  const decrypted = encrypted.decrypt(password);

  console.log(decrypted.value());
})();
