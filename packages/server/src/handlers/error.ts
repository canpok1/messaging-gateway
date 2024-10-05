import { Env } from "@/Env";
import { createLogger } from "@/Logger";
import { RequestParamError } from "@/Request";
import { ErrorObject } from "@/types/api";

export function handleError(env: Env, err, res) {
  if (!err) {
    return;
  }

  const logger = createLogger(env, {});

  if (err instanceof RequestParamError) {
    const errObj: ErrorObject = { message: err.message };
    res.status(400).json(errObj);
    return;
  }

  const msg = "internal server error";
  logger.error(msg, { message: err });
  const errObj: ErrorObject = { message: msg };
  res.status(500).json(errObj);
}
