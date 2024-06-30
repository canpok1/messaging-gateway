import * as line from "@line/bot-sdk";
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

/**
 * チャンネルアクセストークンの発行結果
 */
export interface IssueResult {
  /**
   * チャンネルアクセストークン
   */
  accessToken: string;

  /**
   * チャンネルアクセストークンの有効期限切れまでの秒数
   */
  expiresIn: number;

  /**
   * チャネルアクセストークンを識別するための一意のキーID
   */
  keyId: string;
}

/**
 * チャンネルアクセストークンを発行する
 * https://developers.line.biz/ja/reference/messaging-api/#issue-channel-access-token-v2-1
 * @param jwt JWT
 * @returns 発行した情報
 */
export async function issueChannelAccessToken(
  jwt: string
): Promise<IssueResult> {
  const client = new line.channelAccessToken.ChannelAccessTokenClient({});

  // 型定義はキャメルケースだが実際の値はスネークケースで返されるため、any型として受ける
  const response = (await client.issueChannelTokenByJWT(
    "client_credentials",
    "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    jwt
  )) as any;

  return {
    accessToken: response["access_token"] || response["accessToken"] || "",
    expiresIn: response["expires_in"] || response["expiresIn"] || 0,
    keyId: response["key_id"] || response["keyId"] || "",
  };
}
