import { createEnvParamFromProcessEnv, Env, OptionalEnvParam } from "@/Env";
import { Redis } from "ioredis";

export async function cleanupRedisStream(env: Env, channelId: string) {
  const client = createRedisClient(env);
  const streamName = `${env.redisStreamPrefixForLine}:${channelId}`;
  const t = await client.type(streamName);
  if (t === "stream") {
    await client.del(streamName);
  }
}

export function createRedisClient(env: Env): Redis {
  return new Redis({ host: env.redisHost, port: env.redisPort });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createEnvForTest(
  streamPrefix: string,
  param?: OptionalEnvParam
): Env {
  const env = createEnvParamFromProcessEnv(process.env);
  env.redisStreamPrefixForLine = streamPrefix;
  env.redisMaxRetriesPerRequest = 1;
  if (param) {
    return { ...env, ...param };
  }
  return env;
}
