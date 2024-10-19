import { Request } from "express";
import { RequestParamError } from "@/Error";
export class RequestDataParser {
  private req: Request;

  constructor(req: Request) {
    this.req = req;
  }

  getPathParamAsString(key: string): string {
    const value = this.req.params[key];
    if (!value) {
      throw new RequestParamError(`${key} is required but was not found`);
    }

    return value;
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
