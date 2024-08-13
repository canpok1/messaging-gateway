import { EncryptedValue, SecretString } from "@messaging-gateway/lib";

(async () => {
  const originalText = process.argv[2] || "";
  const password = new SecretString(process.env.ENCRYPTION_PASSWORD || "");
  const encrypted = EncryptedValue.makeFromPlainText(originalText, password);

  console.log(`original: ${originalText}`);
  console.log(`encrypted: ${encrypted.serialize()}`);
})();
