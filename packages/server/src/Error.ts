export class RequestParamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestParamError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
