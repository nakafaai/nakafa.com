/** Reads structured application error data without depending on one transport class. */
export function getApplicationErrorData(error: unknown) {
  if (typeof error !== "object" || error === null || !("data" in error)) {
    return null;
  }

  return error.data;
}

/** Reads one application error code when the transport provided structured data. */
export function getApplicationErrorCode(error: unknown) {
  const data = getApplicationErrorData(error);

  if (typeof data !== "object" || data === null || !("code" in data)) {
    return null;
  }

  return typeof data.code === "string" ? data.code : null;
}

/** Returns whether an unknown error carries one of the expected application codes. */
export function hasApplicationErrorCode(
  error: unknown,
  allowedCodes: readonly string[]
) {
  const code = getApplicationErrorCode(error);

  return code !== null && allowedCodes.includes(code);
}

/** Reads the most useful human-readable error text from a known error shape. */
export function getApplicationErrorText(error: unknown) {
  const data = getApplicationErrorData(error);

  if (typeof data === "string") {
    return data;
  }

  if (typeof data === "object" && data !== null) {
    if ("code" in data && typeof data.code === "string") {
      return data.code;
    }

    if ("message" in data && typeof data.message === "string") {
      return data.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "";
}
