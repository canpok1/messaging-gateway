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

  it("既存の暗号化文字列を復元できること", () => {
    const serialized =
      "eb52fd6329486f272d52af94d64762f9#d6ab5e4bf0b1dcdd967d6772f67c68c9#9c90e8286515e89fec1f734f0714df90";
    const plainText = "abcdefg";
    const password = new SecretString("password");

    const encrypted = EncryptedValue.makeFromSerializedText(serialized);

    const decrypted = encrypted.decrypt(password);
    expect(decrypted.value()).toEqual(plainText);
  });
});
