import winston from "winston";
import { Env } from "@/Env";

const logLevelStrings = [
  "error",
  "warn",
  "info",
  "http",
  "verbose",
  "debug",
  "silly",
] as const;

export type LogLevelString = (typeof logLevelStrings)[number];

export function isLogLevelString(s: string): s is LogLevelString {
  return logLevelStrings.some((v) => v === s);
}

export type Logger = winston.Logger;

export function createLogger(env: Env, options: object): Logger {
  return winston.createLogger({
    level: env.logLevel,
    defaultMeta: { name: env.appName, ...options },
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
    transports: [new winston.transports.Console()],
  });
}

export function createNopLogger(): Logger {
  return winston.createLogger({
    silent: true,
  });
}
