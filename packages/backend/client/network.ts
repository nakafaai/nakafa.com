import { HashSet, MutableHashSet, Predicate, Result, Schema } from "effect";
export const NETWORK_RETRY_DELAYS_MILLISECONDS = [500, 1000] as const;
export const NetworkRetryCodeSchema = Schema.Literals([
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ENETDOWN",
  "ENETUNREACH",
  "EHOSTDOWN",
  "EHOSTUNREACH",
  "EPIPE",
  "UND_ERR_SOCKET",
]);
type NetworkRetryCode = typeof NetworkRetryCodeSchema.Type;
const NETWORK_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,47}$/;
const NETWORK_CAUSE_LIMIT = 32;
const networkRetryCodes = HashSet.fromIterable<string>(
  NetworkRetryCodeSchema.literals
);
/** One rejected fetch has only sanitized retry classification. */
export class NetworkRequestError extends Schema.TaggedError<NetworkRequestError>()(
  "NetworkRequestError",
  {
    networkCodes: Schema.Array(NetworkRetryCodeSchema),
  }
) {}
function isNetworkRetryCode(code: string): code is NetworkRetryCode {
  return HashSet.has(networkRetryCodes, code);
}
/**
 * Classifies nested Node and Undici failures without retaining private data.
 *
 * Retryable codes match the defaults pinned in Undici 7.29.0. Unknown codes,
 * timeouts, aborts, TLS failures, and independent unclassified leaves remain
 * terminal.
 *
 * @see https://github.com/nodejs/undici/blob/v7.29.0/lib/handler/retry-handler.js
 * @see https://nodejs.org/api/errors.html
 */
export function createNetworkRequestError(cause: unknown) {
  const inspection = Result.try(() => inspectNetworkCodes(cause));
  if (Result.isFailure(inspection)) {
    return new NetworkRequestError({
      networkCodes: [],
    });
  }
  const retryable =
    inspection.success.foundCode && !inspection.success.foundTerminalFailure;
  const networkCodes = retryable
    ? NetworkRetryCodeSchema.literals.filter((code) =>
        HashSet.has(inspection.success.retryCodes, code)
      )
    : [];
  return new NetworkRequestError({
    networkCodes,
  });
}
function inspectNetworkCodes(cause: unknown) {
  const pending = [cause];
  const visited = new Set<object>();
  const retryCodes = MutableHashSet.empty<NetworkRetryCode>();
  let foundCode = false;
  let foundTerminalFailure = false;
  while (pending.length > 0 && visited.size < NETWORK_CAUSE_LIMIT) {
    const current = pending.pop();
    if (!Predicate.isObjectOrArray(current)) {
      continue;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);
    const inspection = inspectNetworkNode(
      current,
      NETWORK_CAUSE_LIMIT - pending.length - visited.size
    );
    foundCode ||= inspection.hasNetworkCode;
    foundTerminalFailure ||= inspection.foundTerminalFailure;
    if (inspection.retryCode !== undefined) {
      MutableHashSet.add(retryCodes, inspection.retryCode);
    }
    pending.push(...inspection.children);
  }
  return {
    foundCode,
    foundTerminalFailure: foundTerminalFailure || pending.length > 0,
    retryCodes: HashSet.fromIterable(retryCodes),
  };
}

/** Inspects one failure and retains only the children allowed by the graph bound. */
function inspectNetworkNode(current: object, remainingCapacity: number) {
  const hasCodeProperty = "code" in current;
  const code = hasCodeProperty ? current.code : undefined;
  const hasNetworkCode =
    Predicate.isString(code) && NETWORK_CODE_PATTERN.test(code);
  const retryCode =
    hasNetworkCode && isNetworkRetryCode(code) ? code : undefined;
  const children: object[] = [];
  let foundTerminalFailure = hasCodeProperty && retryCode === undefined;
  if ("cause" in current) {
    const nestedCause = current.cause;
    if (Predicate.isObjectOrArray(nestedCause)) {
      children.push(nestedCause);
    } else {
      foundTerminalFailure = true;
    }
  }
  if (current instanceof AggregateError) {
    for (const error of current.errors) {
      if (!Predicate.isObjectOrArray(error)) {
        foundTerminalFailure = true;
        continue;
      }
      if (children.length >= remainingCapacity) {
        foundTerminalFailure = true;
        break;
      }
      children.push(error);
    }
  }
  return {
    children,
    foundTerminalFailure:
      foundTerminalFailure || !(hasNetworkCode || children.length > 0),
    hasNetworkCode,
    retryCode,
  };
}
/** Returns whether a rejected fetch is safe for a bounded retry. */
export function isRetryableNetworkError(error: NetworkRequestError) {
  return error.networkCodes.length > 0;
}
