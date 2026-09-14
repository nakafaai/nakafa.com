import { ConvexError } from "convex/values";
import { Predicate } from "effect";

/** Extract a human-readable message from unknown thrown values. */
export function getErrorMessage(error: unknown) {
  if (error instanceof ConvexError) {
    const { data } = error;

    if (Predicate.isObject(data) && Predicate.hasProperty(data, "message")) {
      const { message } = data;

      if (Predicate.isString(message)) {
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
