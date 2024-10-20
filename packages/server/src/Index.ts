import { createEnvParamFromProcessEnv } from "@/Env";
import { createLogger } from "@/Logger";
import { createApp } from "@/App";
import { MessageCleaner } from "./Cleaner";

const env = createEnvParamFromProcessEnv(process.env);
const logger = createLogger(env, {});
const app = createApp(env, logger);

logger.info(`start ${env.appName}`);

if (process.env.NODE_ENV === "production") {
  const port = 3000;
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

const cleaner = new MessageCleaner(
  env,
  env.cleanerConsumerName,
  env.cleanerMinIdleMs,
  env.cleanerBatchSize
);
setInterval(async () => {
  cleaner.clean(logger);
}, env.cleanerIntervalMs);

export const viteNodeApp = app;
