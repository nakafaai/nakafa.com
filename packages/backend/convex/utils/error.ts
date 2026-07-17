import { ConvexError } from "convex/values";

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
