import { Env } from "@/Env";
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
