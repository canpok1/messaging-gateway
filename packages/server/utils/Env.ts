import { SecretString } from "@messaging-gateway/lib";
import { isLogLevelString, LogLevelString } from "./Logger";

export class Env {
  readonly appName: string;
  readonly logLevel: LogLevelString;
  readonly encryptionPassword: SecretString;

  constructor(env: NodeJS.ProcessEnv) {
    this.appName = getStringValue(env, "APP_NAME");
    this.logLevel = getLogLevel(env, "LOG_LEVEL");
    this.encryptionPassword = getSecretStringValue(env, "ENCRYPTION_PASSWORD");
  }
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
