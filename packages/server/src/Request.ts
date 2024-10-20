import { Request } from "express";
import { RequestParamError } from "@/Error";
export class RequestDataParser {
  private req: Request;

  constructor(req: Request) {
    this.req = req;
  }

  getHeaderAsString(key: string): string {
    const value = this.req.get(key);
    if (!value) {
      throw new RequestParamError(
        `${key} is required header but was not found`
      );
    }

    return value;
  }

  getPathParamAsString(key: string): string {
    const value = this.req.params[key];
    if (!value) {
      throw new RequestParamError(
        `${key} is required path param but was not found`
      );
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

  getQueryParamAsStringWithDefault(key: string, def: string): string {
    return this.getQueryParamAsStringOrUndefined(key) || def;
  }

  getQueryParamAsString(key: string): string {
    const value = this.getQueryParamAsStringOrUndefined(key);
    if (!value) {
      throw new RequestParamError(
        `${key} is required query param but was not found`
      );
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

  getQueryParamAsNumberWithDefault(key: string, def: number): number {
    return this.getQueryParamAsNumberOrUndefined(key) || def;
  }
}
