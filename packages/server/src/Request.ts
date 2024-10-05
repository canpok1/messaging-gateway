import { Request } from "express";
export class RequestParam {
  private req: Request;

  constructor(req: Request) {
    this.req = req;
  }

  getStringValue(key: string): string | undefined {
    const value = this.req.query[key];
    if (typeof value === "string") {
      return value;
    } else {
      return undefined;
    }
  }

  getRequiredStringValue(key: string): string {
    const value = this.getStringValue(key);
    if (!value) {
      throw new RequestParamError(`${key} is required but was not found`);
    }

    return value;
  }

  getNumberValue(key: string): number | undefined {
    const value = this.getStringValue(key);
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
