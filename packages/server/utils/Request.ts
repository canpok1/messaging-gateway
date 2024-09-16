export class RequestParam {
  private params: URLSearchParams;

  constructor(params: URLSearchParams) {
    this.params = params;
  }

  getStringValue(key: string): string | undefined {
    return this.params.has(key) ? this.params.get(key) : undefined;
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
