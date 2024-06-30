import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";
import { SecretString } from "./Secret";

const ALGORITHM = "aes-256-cbc";
const DELIMITER = "#";

function makeKey(password: SecretString, salt: Buffer): Buffer {
  return scryptSync(password.value(), salt, 32);
}

export class EncryptedValue {
  cipherText: string;
  iv: Buffer;
  salt: Buffer;

  static makeFromPlainText(
    plainText: string,
    password: SecretString
  ): EncryptedValue {
    const { cipherText, iv, salt } = encrypt(plainText, password);
    return new EncryptedValue(cipherText, iv, salt);
  }

  static makeFromSerializedText(serializedText: string): EncryptedValue {
    const splited = serializedText.split(DELIMITER);
    if (splited.length != 3) {
      throw new Error(
        `invalid serializedText, splited length is not 3, original:${serializedText}, splited:${splited}`
      );
    }

    const iv = Buffer.from(splited[0], "hex");
    const salt = Buffer.from(splited[1], "hex");
    const cipherText = splited[2];
    return new EncryptedValue(cipherText, iv, salt);
  }

  constructor(cipherText: string, iv: Buffer, salt: Buffer) {
    this.cipherText = cipherText;
    this.iv = iv;
    this.salt = salt;
  }

  serialize(): string {
    return (
      this.iv.toString("hex") +
      DELIMITER +
      this.salt.toString("hex") +
      DELIMITER +
      this.cipherText
    );
  }

  decrypt(password: SecretString): SecretString {
    return decrypt(this.cipherText, password, this.salt, this.iv);
  }
}

function encrypt(
  plainText: string,
  password: SecretString
): {
  cipherText: string;
  iv: Buffer;
  salt: Buffer;
} {
  const iv = randomBytes(16);
  const salt = randomBytes(16);
  const key = makeKey(password, salt);

  const cipher = createCipheriv(ALGORITHM, key, iv);

  let cipherText = cipher.update(plainText, "utf8", "hex");
  cipherText += cipher.final("hex");

  return {
    cipherText,
    iv,
    salt,
  };
}

function decrypt(
  cipherText: string,
  password: SecretString,
  salt: Buffer,
  iv: Buffer
): SecretString {
  const key = makeKey(password, salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv);

  let plainText = decipher.update(cipherText, "hex", "utf8");
  plainText += decipher.final("utf8");

  return new SecretString(plainText);
}
