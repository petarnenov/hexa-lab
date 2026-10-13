// ApiError - the one error the API client throws.
//
// `status` is the HTTP status (0 when fetch itself rejected: no response at
// all, the XHR convention). `code` is the server's `error` field, or
// "NETWORK_ERROR" when there was no JSON error body to read it from. The
// components switch on `code`, never on the message text.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
