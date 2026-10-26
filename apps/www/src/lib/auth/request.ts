import {
  NETWORK_ATTEMPT_DEADLINE,
  RetryableNetworkAttempt,
  retryNetworkAttempt,
} from "@repo/backend/client/network";
import { Data, Effect, Schema } from "effect";
import { bufferResponse } from "@/lib/auth/body";
import { SESSION_PATH } from "@/lib/auth/session";

/** The browser could not send a Better Auth request or read its answer. */
export class AuthRequestFailed extends Schema.TaggedError<AuthRequestFailed>()(
  "AuthRequestFailed",
  {
    cause: Schema.Unknown,
  }
) {}

/** A Better Auth request did not answer within the shared attempt deadline. */
export class AuthRequestDeadline extends Schema.TaggedError<AuthRequestDeadline>()(
  "AuthRequestDeadline",
  {}
) {}

/**
 * A read of the session that the server answered with an error status. It is
 * read again, and the last such answer is the one the caller gets.
 */
class SessionReadRefused extends Data.TaggedError("SessionReadRefused")<{
  readonly response: Response;
}> {}

/** Every way one attempt to read the session can fail. */
type SessionReadFailure =
  | AuthRequestFailed
  | AuthRequestDeadline
  | SessionReadRefused;

/**
 * Lets a relative address parse. Only its path is read, so the origin is never
 * used.
 */
const ADDRESS_BASE = "https://auth.invalid";

/**
 * Fails at once when the caller's signal aborts. The browser owns that signal,
 * so this watches it instead of creating one.
 */
const abortedByCaller = (caller: AbortSignal) =>
  Effect.callback<never, AuthRequestFailed>((resume) => {
    const abort = () =>
      resume(Effect.fail(new AuthRequestFailed({ cause: caller.reason })));
    if (caller.aborted) {
      abort();
      return;
    }
    caller.addEventListener("abort", abort, { once: true });
    return Effect.sync(() => caller.removeEventListener("abort", abort));
  });

/** Runs a request until it ends or the caller aborts, whichever comes first. */
const untilCallerAborts = <A, E>(
  request: Effect.Effect<A, E>,
  caller: AbortSignal | null | undefined
) => (caller ? Effect.raceFirst(request, abortedByCaller(caller)) : request);

/**
 * Sends one attempt and reads the whole answer, so the body is read inside
 * whatever deadline the caller sets. Interrupting the attempt aborts its fetch
 * and its body read.
 */
const sendAttempt = (
  send: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit
) =>
  Effect.tryPromise({
    try: (signal) => send(input, { ...init, signal }).then(bufferResponse),
    catch: (cause) => new AuthRequestFailed({ cause }),
  });

/**
 * Sends one Better Auth request under the shared attempt deadline, and fails at
 * once when the caller aborts. The deadline covers the answer's body as well as
 * its headers: `fetch` resolves with the headers, and Better Fetch reads the body
 * afterwards, so the body is read here, inside the deadline.
 *
 * Better-fetch arms its own `timeout` only for a request without a signal, and
 * Better Auth's session read always sends one. The deadline therefore lives here,
 * where every request passes. Interrupting the request aborts its fetch and its
 * body read, so the deadline and the caller's abort both close the connection.
 */
export const requestWithDeadline = Effect.fn("www.auth.requestWithDeadline")(
  function* (
    send: typeof fetch,
    input: RequestInfo | URL,
    init: RequestInit = {}
  ) {
    const request = sendAttempt(send, input, init).pipe(
      Effect.timeoutOrElse({
        duration: NETWORK_ATTEMPT_DEADLINE,
        orElse: () => Effect.fail(new AuthRequestDeadline()),
      })
    );
    return yield* untilCallerAborts(request, init.signal);
  }
);

/**
 * Reads the session, and reads it again on the shared schedule when the request
 * gets no answer, the server answers with an error status, or an attempt misses
 * its deadline. The request is a read, so repeating it is safe, and a network
 * that drops one request must not keep the page from its session: Better Auth
 * asks again only when the learner returns to the tab or the network returns.
 * After the last attempt the refused answer goes to the caller as it came, and
 * a request that got no answer fails as it did, so Better Auth reports either.
 */
export const readSession = Effect.fn("www.auth.readSession")(function* (
  send: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit = {}
) {
  const attempt: Effect.Effect<
    Response,
    SessionReadFailure | RetryableNetworkAttempt<SessionReadFailure>
  > = sendAttempt(send, input, init).pipe(
    Effect.mapError((failure) => new RetryableNetworkAttempt({ failure })),
    Effect.filterOrFail(
      (response) => response.status < 500,
      (response) =>
        new RetryableNetworkAttempt({
          failure: new SessionReadRefused({ response }),
        })
    )
  );
  const read = retryNetworkAttempt(attempt, new AuthRequestDeadline()).pipe(
    Effect.catchTag("SessionReadRefused", ({ response }) =>
      Effect.succeed(response)
    )
  );
  return yield* untilCallerAborts(read, init.signal);
});

/**
 * Whether a request is a read of the session: the only Better Auth request the
 * browser sends again. Better Auth hands its client's fetch the address as a
 * string or a URL, so any other input is never taken for the read.
 */
function isSessionRead(
  input: RequestInfo | URL,
  init: RequestInit | undefined
) {
  return (
    init?.method === "GET" &&
    new URL(String(input), ADDRESS_BASE).pathname === SESSION_PATH
  );
}

/** The fetch that Better Auth's browser client calls for every request. */
export const authFetch = (input: RequestInfo | URL, init?: RequestInit) =>
  Effect.runPromise(
    isSessionRead(input, init)
      ? readSession(fetch, input, init)
      : requestWithDeadline(fetch, input, init)
  );
