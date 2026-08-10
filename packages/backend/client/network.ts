import { Either, Schema } from "effect";

export const NETWORK_RETRY_DELAYS_MILLISECONDS = [500, 1000] as const;

export const NetworkRetryCodeSchema = Schema.Literal(
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ENETDOWN",
  "ENETUNREACH",
  "EHOSTDOWN",
  "EHOSTUNREACH",
  "EPIPE",
  "UND_ERR_SOCKET"
);

type NetworkRetryCode = Schema.Schema.Type<typeof NetworkRetryCodeSchema>;

const NETWORK_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,47}$/;
const NETWORK_CAUSE_LIMIT = 32;
const networkRetryCodes: ReadonlySet<string> = new Set(
  NetworkRetryCodeSchema.literals
);

/** One rejected fetch has only sanitized retry classification. */
export class NetworkRequestError extends Schema.TaggedError<NetworkRequestError>()(
  "NetworkRequestError",
  {
    networkCodes: Schema.Array(NetworkRetryCodeSchema),
  }
) {}

interface NetworkCodeInspection {
  readonly foundCode: boolean;
  readonly foundTerminalFailure: boolean;
  readonly retryCodes: ReadonlySet<NetworkRetryCode>;
}

function isNetworkRetryCode(code: string): code is NetworkRetryCode {
  return networkRetryCodes.has(code);
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
  const inspection = Either.try(() => inspectNetworkCodes(cause));
  if (Either.isLeft(inspection)) {
    return new NetworkRequestError({ networkCodes: [] });
  }

  const retryable =
    inspection.right.foundCode && !inspection.right.foundTerminalFailure;
  const networkCodes = retryable
    ? NetworkRetryCodeSchema.literals.filter((code) =>
        inspection.right.retryCodes.has(code)
      )
    : [];

  return new NetworkRequestError({ networkCodes });
}

function inspectNetworkCodes(cause: unknown): NetworkCodeInspection {
  const pending = [cause];
  const visited = new Set<object>();
  const retryCodes = new Set<NetworkRetryCode>();
  let foundCode = false;
  let foundTerminalFailure = false;

  while (pending.length > 0 && visited.size < NETWORK_CAUSE_LIMIT) {
    const current = pending.pop();
    if (typeof current !== "object" || current === null) {
      continue;
    }
    if (visited.has(current)) {
      continue;
    }
    visited.add(current);

    const hasCodeProperty = "code" in current;
    const code = hasCodeProperty ? current.code : undefined;
    const hasNetworkCode =
      typeof code === "string" && NETWORK_CODE_PATTERN.test(code);
    if (hasNetworkCode) {
      foundCode = true;
      if (isNetworkRetryCode(code)) {
        retryCodes.add(code);
      } else {
        foundTerminalFailure = true;
      }
    } else if (hasCodeProperty) {
      foundTerminalFailure = true;
    }

    let hasObjectChild = false;
    if ("cause" in current) {
      const nestedCause = current.cause;
      if (typeof nestedCause === "object" && nestedCause !== null) {
        hasObjectChild = true;
        pending.push(nestedCause);
      } else {
        foundTerminalFailure = true;
      }
    }
    if (current instanceof AggregateError) {
      for (const error of current.errors) {
        if (typeof error !== "object" || error === null) {
          foundTerminalFailure = true;
          continue;
        }
        hasObjectChild = true;
        if (pending.length + visited.size >= NETWORK_CAUSE_LIMIT) {
          foundTerminalFailure = true;
          break;
        }
        pending.push(error);
      }
    }
    if (!(hasNetworkCode || hasObjectChild)) {
      foundTerminalFailure = true;
    }
  }

  return {
    foundCode,
    foundTerminalFailure: foundTerminalFailure || pending.length > 0,
    retryCodes,
  };
}

/** Returns whether a rejected fetch is safe for a bounded retry. */
export function isRetryableNetworkError(error: NetworkRequestError) {
  return error.networkCodes.length > 0;
}
