import { ConvexError } from "convex/values";
import { Predicate } from "effect";

/**
 * Reads the bounded failure code from one rejected content-view write.
 *
 * A write reaches this seam either as a typed Convex failure that carries the
 * server code, or as a transport failure that never reached Convex. Only the
 * code leaves the browser, so the failure stays attributable while the message
 * and payload stay out of analytics.
 */
export function readContentViewErrorCode(error: unknown) {
  if (!(error instanceof ConvexError)) {
    return;
  }

  const data: unknown = error.data;

  if (!(Predicate.isObject(data) && Predicate.hasProperty(data, "code"))) {
    return;
  }

  return Predicate.isString(data.code) ? data.code : undefined;
}
