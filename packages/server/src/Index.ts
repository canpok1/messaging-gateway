import { createEnvParamFromProcessEnv, Env } from "@/Env";
import { createLogger } from "@/Logger";
import { createApp } from "@/App";

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

export const viteNodeApp = app;
