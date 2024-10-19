import { Logger } from "@/Logger";
import { NotFoundError, RequestParamError } from "@/Error";
import { ErrorObject } from "@/types/api";

export function handleError(logger: Logger, err, res) {
  if (!err) {
    return;
  }

  if (err instanceof RequestParamError) {
    const errObj: ErrorObject = { message: err.message };
    res.status(400).json(errObj);
    return;
  }

  if (err instanceof NotFoundError) {
    const errObj: ErrorObject = { message: err.message };
    res.status(404).json(errObj);
    return;
  }

  const msg = "internal server error";
  logger.error(msg, { message: err });
  const errObj: ErrorObject = { message: msg };
  res.status(500).json(errObj);
}
