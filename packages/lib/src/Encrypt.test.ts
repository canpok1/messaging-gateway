import { EncryptedValue } from "./Encrypt";
import { SecretString } from "./Secret";

describe("EncryptedValueクラス", () => {
  const dummyPassword = new SecretString("dummy");

  it("暗号化文字列が元の文字と異なること", () => {
    const plainText = "dummy text";
    const encrypted = EncryptedValue.makeFromPlainText(
      plainText,
      dummyPassword
    );

    expect(encrypted.cipherText).not.toEqual(plainText);
  });

  it("復号化した文字列が元の文字と同じであること", () => {
    const plainText = "dummy text";
    const encrypted = EncryptedValue.makeFromPlainText(
      plainText,
      dummyPassword
    );

    const decrypted = encrypted.decrypt(dummyPassword);

    expect(decrypted.value()).toEqual(plainText);
  });

  it("serialize文字列から復元できること", () => {
    const plainText = "dummy text";
    const org = EncryptedValue.makeFromPlainText(plainText, dummyPassword);

    const copy = EncryptedValue.makeFromSerializedText(org.serialize());

    expect(org).toEqual(copy);
  });
});
