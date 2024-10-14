import { Env } from "@/Env";
import { Redis } from "ioredis";

export async function cleanupRedisStream(env: Env) {
  const client = createRedisClient(env);
  const t = await client.type(env.redisStreamNameForLine);
  if (t === "stream") {
    await client.del(env.redisStreamNameForLine);
  }
}

export function createRedisClient(env: Env): Redis {
  return new Redis({ host: env.redisHost, port: env.redisPort });
}
