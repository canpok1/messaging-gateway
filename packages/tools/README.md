# tools

## JwtGenerator

LINE のチャネルアクセストークン発行で必要な JWT を生成するツール。
生成される JWT の有効期限は 30 分、JWT を使って発行されるチャネルアクセスアクセストークンの有効期限は 30 日。

https://developers.line.biz/ja/docs/messaging-api/generate-json-web-token/#generate-jwt

### usage

`packages/tools/.env-template` をコピーして `packages/tools/.env` を作成し、以下のコマンドを実行する。

```
npm run -w tools generate-jwt
```

## LineMessageSender

LINE にメッセージを送信するツール。

### usage

`packages/tools/.env-template` をコピーして `packages/tools/.env` を作成し、以下のコマンドを実行する。

```
npm run -w tools send-line-message {送付先のユーザーID/グループID} {送付するメッセージ}
```
