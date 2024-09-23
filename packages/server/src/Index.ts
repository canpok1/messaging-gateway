import express from "express";
import { Env } from "./Env";
import { POST as postMessage } from "./handlers/api/line/v2/bot/message/push/route";
import { POST as postEvent } from "./handlers/api/line/webhook/events/route";
import { GET as getNewMessage } from "./handlers/api/line/webhook/messages/new/route";

const env = new Env(process.env);
const app = express();

console.log(`start ${env.appName}`);

app.use(express.json());

app.get("/", (req, res) => {
  res.send(`running ${env.appName}`);
});
app.post("/api/line/v2/bot/message/push", async (req, res) => {
  await postMessage(env, req, res);
});
app.post("/api/line/webhook/events", async (req, res) => {
  await postEvent(env, req, res);
});
app.get("/api/line/webhook/messages/new", async (req, res) => {
  await getNewMessage(env, req, res);
});

if (process.env.NODE_ENV === "production") {
  const port = 3000;
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

export const viteNodeApp = app;
