import { Api } from "../tl/api.js";

class CustomError extends Error {
  constructor(message?: string) {
    super(message);
  }
}

export class RPCError extends CustomError {
  constructor(
    public errorMessage: string,
    request: Api.AnyRequest,
    public code?: number,
  ) {
    super(
      "{0}: {1}{2}"
        .replace("{0}", code?.toString() || "")
        .replace("{1}", errorMessage || "")
        .replace("{2}", RPCError._fmtRequest(request)),
    );
  }

  static _fmtRequest(request: Api.AnyRequest) {
    // TODO fix this
    if (request) {
      return ` (caused by ${request.className})`;
    } else {
      return "";
    }
  }
}

export class InvalidDCError extends RPCError {
  constructor(message: string, request: Api.AnyRequest, code?: number) {
    super(message, request, code);
    this.code = code || 303;
    this.errorMessage = message || "ERROR_SEE_OTHER";
  }
}
export class BadRequestError extends RPCError {
  code = 400;
  errorMessage = "BAD_REQUEST";
}

export class UnauthorizedError extends RPCError {
  code = 401;
  errorMessage = "UNAUTHORIZED";
}

export class ForbiddenError extends RPCError {
  code = 403;
  errorMessage = "FORBIDDEN";
}

export class NotFoundError extends RPCError {
  code = 404;
  errorMessage = "NOT_FOUND";
}

export class AuthKeyError extends RPCError {
  code = 406;
  errorMessage = "AUTH_KEY";
}

export class FloodError extends RPCError {
  code = 420;
  errorMessage = "FLOOD";
}

export class ServerError extends RPCError {
  code = 500; // Also witnessed as -500
  errorMessage = "INTERNAL";
}

export class TimedOutError extends RPCError {
  code = 503; // Only witnessed as -503
  errorMessage = "Timeout";
}
