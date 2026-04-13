import { ConvexError } from "convex/values";

/** Extracts one structured Convex application error code from an unknown error. */
export function getConvexErrorCode(error: unknown) {
  if (!(error instanceof ConvexError)) {
    return null;
  }

  const data = error.data;

  if (typeof data !== "object" || data === null || !("code" in data)) {
    return null;
  }

  return typeof data.code === "string" ? data.code : null;
}

/** Extract a human-readable message from unknown thrown values. */
export function getErrorMessage(error: unknown) {
  if (error instanceof ConvexError) {
    const data = error.data;

    if (typeof data === "object" && data !== null && "message" in data) {
      const message = data.message;

      if (typeof message === "string") {
        return message;
      }
    }

    return JSON.stringify(data);
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
