import { EncryptedValue, SecretString } from "../../lib/src/Index";

(async () => {
  const text = process.argv[2];
  const encrypted = EncryptedValue.makeFromSerializedText(text);
  const password = new SecretString(process.env.ENCRYPTION_PASSWORD || "");
  const decrypted = encrypted.decrypt(password);

  console.log(`text: ${text}`);
  console.log(`decrypted: ${decrypted.value()}`);
})();
