import {
  Array as Arr,
  Data,
  Duration,
  Effect,
  HashSet,
  MutableHashSet,
  MutableList,
  Predicate,
  Result,
  Schedule,
  Schema,
} from "effect";

const NETWORK_RETRY_DELAYS_MILLISECONDS = [500, 1000] as const;
/**
 * Two retries, after 500 milliseconds and then 1 second, for every transient
 * read: Convex queries from the web app, content runtime reads, and the session
 * token read.
 */
export const NETWORK_RETRY_SCHEDULE = Schedule.recurs(2).pipe(
  Schedule.addDelay(({ attempt }) =>
    Effect.succeed(
      attempt === 1
        ? NETWORK_RETRY_DELAYS_MILLISECONDS[0]
        : NETWORK_RETRY_DELAYS_MILLISECONDS[1]
    )
  )
);
/**
 * Each attempt of a network read may take at most this long. With the two
 * retries above, one read answers or fails within 31.5 seconds.
 */
export const NETWORK_ATTEMPT_DEADLINE = Duration.seconds(10);
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
    ? Arr.filter(NetworkRetryCodeSchema.literals, (code) =>
        HashSet.has(inspection.success.retryCodes, code)
      )
    : [];
  return new NetworkRequestError({
    networkCodes,
  });
}
/**
 * Identity membership for failures already inspected. Effect collections hash
 * plain objects by structure, which would merge distinct failures that share a
 * code and undercount the graph bound.
 */
const isVisited = Arr.containsWith<object>((node, other) => node === other);
function inspectNetworkCodes(cause: unknown) {
  const pending = MutableList.make<unknown>();
  MutableList.append(pending, cause);
  const visited = MutableList.make<object>();
  const retryCodes = MutableHashSet.empty<NetworkRetryCode>();
  let foundCode = false;
  let foundTerminalFailure = false;
  while (pending.length > 0 && visited.length < NETWORK_CAUSE_LIMIT) {
    const current = MutableList.take(pending);
    if (!Predicate.isObjectOrArray(current)) {
      continue;
    }
    if (isVisited(MutableList.toArray(visited), current)) {
      continue;
    }
    MutableList.append(visited, current);
    const inspection = inspectNetworkNode(
      current,
      NETWORK_CAUSE_LIMIT - pending.length - visited.length
    );
    foundCode ||= inspection.hasNetworkCode;
    foundTerminalFailure ||= inspection.foundTerminalFailure;
    if (inspection.retryCode !== undefined) {
      MutableHashSet.add(retryCodes, inspection.retryCode);
    }
    // The list is a stack: pushing the children in order leaves the last one at the front.
    for (const child of inspection.children) {
      MutableList.prepend(pending, child);
    }
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
  const children = MutableList.make<object>();
  let foundTerminalFailure = hasCodeProperty && retryCode === undefined;
  if ("cause" in current) {
    const nestedCause = current.cause;
    if (Predicate.isObjectOrArray(nestedCause)) {
      MutableList.append(children, nestedCause);
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
      MutableList.append(children, error);
    }
  }
  return {
    children: MutableList.toArray(children),
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

/**
 * One failed attempt that the shared schedule may repeat. `failure` is the
 * caller's own error.
 */
export class RetryableNetworkAttempt<Failure> extends Data.TaggedError(
  "RetryableNetworkAttempt"
)<{
  readonly failure: Failure;
}> {}

/**
 * Keeps the caller's failure, marked retryable only when the transport cause is
 * one that is safe to repeat. Pass the cause itself: effect/http keeps it at
 * `error.reason.cause`, and @confect/js keeps it at `error.cause`.
 */
export function classifyNetworkFailure<Failure>(
  cause: unknown,
  failure: Failure
): Failure | RetryableNetworkAttempt<Failure> {
  return isRetryableNetworkError(createNetworkRequestError(cause))
    ? new RetryableNetworkAttempt({ failure })
    : failure;
}

/**
 * Runs one attempt under NETWORK_ATTEMPT_DEADLINE and repeats it on
 * NETWORK_RETRY_SCHEDULE while it fails retryably. A missed deadline is a
 * retryable failure that carries `deadlineFailure`. The last failure leaves
 * unwrapped, so every caller keeps its own error type.
 */
export const retryNetworkAttempt = Effect.fn("network.retryAttempt")(function* <
  A,
  Failure,
  Requirements,
>(
  attempt: Effect.Effect<
    A,
    Failure | RetryableNetworkAttempt<Failure>,
    Requirements
  >,
  deadlineFailure: Failure
) {
  return yield* attempt.pipe(
    Effect.timeoutOrElse({
      duration: NETWORK_ATTEMPT_DEADLINE,
      orElse: () =>
        Effect.fail(new RetryableNetworkAttempt({ failure: deadlineFailure })),
    }),
    Effect.retry({
      schedule: NETWORK_RETRY_SCHEDULE,
      while: (error) => error instanceof RetryableNetworkAttempt,
    }),
    Effect.catchIf(
      (error): error is RetryableNetworkAttempt<Failure> =>
        error instanceof RetryableNetworkAttempt,
      ({ failure }) => Effect.fail(failure)
    )
  );
});
