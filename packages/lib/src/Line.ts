import jose from "node-jose";

/**
 * LINEのチャネルアクセストークンv2.1用のJWTを生成する
 * https://developers.line.biz/ja/docs/messaging-api/generate-json-web-token/#generate-jwt
 * @param channelId チャネルID
 * @param privateKey 秘密鍵
 * @param kid LINEから発行されたkid
 * @param tokenExpSec チャネルアクセストークンの有効期間（秒）
 * @returns JWT（有効期限は30分）
 */
export async function generateJwt(
  channelId: string,
  privateKey: string,
  kid: string,
  tokenExpSec: number
): Promise<string> {
  let header = {
    alg: "RS256",
    typ: "JWT",
    kid: kid,
  };

  let payload = {
    iss: channelId,
    sub: channelId,
    aud: "https://api.line.me/",
    exp: Math.floor(new Date().getTime() / 1000) + 60 * 30,
    token_exp: tokenExpSec,
  };

  const result = await jose.JWS.createSign(
    { format: "compact", fields: header },
    JSON.parse(privateKey)
  )
    .update(JSON.stringify(payload))
    .final();

  return result.toString();
}
