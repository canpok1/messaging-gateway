import { SecretString } from "@messaging-gateway/lib";
import { isLogLevelString, LogLevelString } from "@/Logger";

export interface EnvParam {
  appName: string;
  logLevel: LogLevelString;
  encryptionPassword: SecretString;
  redisHost: string;
  redisPort: number;
  redisMaxRetriesPerRequest: number;
  redisStreamPrefixForLine: string;
  redisGroupNameForLine: string;
  cleanerConsumerName: string;
  cleanerMinIdleMs: number;
  cleanerBatchSize: number;
  cleanerIntervalMs: number;
}

export type OptionalEnvParam = Partial<EnvParam>;
export type Env = Readonly<EnvParam>;

export function createEnvParamFromProcessEnv(env: NodeJS.ProcessEnv): EnvParam {
  return {
    appName: getStringValue(env, "APP_NAME"),
    logLevel: getLogLevel(env, "LOG_LEVEL"),
    encryptionPassword: getSecretStringValue(env, "ENCRYPTION_PASSWORD"),
    redisHost: getStringValue(env, "REDIS_HOST"),
    redisPort: getNumberValue(env, "REDIS_PORT"),
    redisMaxRetriesPerRequest: getNumberValue(
      env,
      "REDIS_MAX_RETRIES_PER_REQUEST"
    ),
    redisStreamPrefixForLine: getStringValue(
      env,
      "REDIS_STREAM_PREFIX_FOR_LINE"
    ),
    redisGroupNameForLine: getStringValue(env, "REDIS_GROUP_NAME_FOR_LINE"),
    cleanerConsumerName: getStringValue(env, "CLEANER_CONSUMER_NAME"),
    cleanerMinIdleMs: getNumberValue(env, "CLEANER_MIN_IDLE_MS"),
    cleanerBatchSize: getNumberValue(env, "CLEANER_BATCH_SIZE"),
    cleanerIntervalMs: getNumberValue(env, "CLEANER_INTERVAL_MS"),
  };
}

function getStringValue(
  env: NodeJS.ProcessEnv,
  key: string,
  required: boolean = true
): string {
  const value = env[key];
  if (value === undefined) {
    if (required) {
      throw new Error(`environment[${key}] is not found`);
    }
    return "";
  }
  return value;
}

function getNumberValue(env: NodeJS.ProcessEnv, key: string): number {
  return Number(getStringValue(env, key));
}

function getLogLevel(env: NodeJS.ProcessEnv, key: string): LogLevelString {
  const s = getStringValue(env, key);
  if (isLogLevelString(s)) {
    return s;
  } else {
    throw new Error(`environment[${key}] is invalid value[${s}]`);
  }
}

function getSecretStringValue(
  env: NodeJS.ProcessEnv,
  key: string
): SecretString {
  const s = getStringValue(env, key);
  return new SecretString(s);
}
