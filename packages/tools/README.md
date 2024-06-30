# tools

## JwtGenerator

LINE のチャネルアクセストークン発行で必要な JWT を生成するツール。
生成される JWT の有効期限は 30 分、JWT を使って発行されるチャネルアクセスアクセストークンの有効期限は 30 日。

https://developers.line.biz/ja/docs/messaging-api/generate-json-web-token/#generate-jwt

### usage

```
npm run -w tools generate-jwt {チャンネルID} {暗号鍵ファイルの絶対パス} {kid}
```
