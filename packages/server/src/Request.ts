import { Request } from "express";
export class RequestDataParser {
  private req: Request;

  constructor(req: Request) {
    this.req = req;
  }

  getQueryParamAsStringOrUndefined(key: string): string | undefined {
    const value = this.req.query[key];
    if (typeof value === "string") {
      return value;
    } else {
      return undefined;
    }
  }

  getQueryParamAsString(key: string): string {
    const value = this.getQueryParamAsStringOrUndefined(key);
    if (!value) {
      throw new RequestParamError(`${key} is required but was not found`);
    }

    return value;
  }

  getQueryParamAsNumberOrUndefined(key: string): number | undefined {
    const value = this.getQueryParamAsStringOrUndefined(key);
    if (value === undefined) {
      return undefined;
    }

    const numberValue = Number(value);
    if (isNaN(numberValue)) {
      throw new RequestParamError(`${key} should be a number`);
    }

    return numberValue;
  }
}

export class RequestParamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestParamError";
  }
}
