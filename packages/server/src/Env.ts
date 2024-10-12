import { SecretString } from "@messaging-gateway/lib";
import { isLogLevelString, LogLevelString } from "@/Logger";

export interface Env {
  readonly appName: string;
  readonly logLevel: LogLevelString;
  readonly encryptionPassword: SecretString;
  readonly redisHost: string;
  readonly redisPort: number;
  readonly redisStreamNameForLine: string;
  readonly redisGroupNameForLine: string;
}

export function createEnvFromProcessEnv(env: NodeJS.ProcessEnv): Env {
  return {
    appName: getStringValue(env, "APP_NAME"),
    logLevel: getLogLevel(env, "LOG_LEVEL"),
    encryptionPassword: getSecretStringValue(env, "ENCRYPTION_PASSWORD"),
    redisHost: getStringValue(env, "REDIS_HOST"),
    redisPort: getNumberValue(env, "REDIS_PORT"),
    redisStreamNameForLine: getStringValue(env, "REDIS_STREAM_NAME_FOR_LINE"),
    redisGroupNameForLine: getStringValue(env, "REDIS_GROUP_NAME_FOR_LINE"),
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
