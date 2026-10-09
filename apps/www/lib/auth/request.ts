import { NETWORK_ATTEMPT_DEADLINE } from "@repo/backend/client/network";
import { Effect, Schema } from "effect";
import { bufferResponse } from "@/lib/auth/body";

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
 * Fails at once when the caller's signal aborts. The browser owns that signal,
 * so this watches it instead of creating one.
 */
const abortedByCaller = (caller: AbortSignal) =>
  Effect.callback<never, AuthRequestFailed>((resume) => {
    const abort = () =>
      resume(Effect.fail(AuthRequestFailed.make({ cause: caller.reason })));
    if (caller.aborted) {
      abort();
      return;
    }
    caller.addEventListener("abort", abort, { once: true });
    return Effect.sync(() => caller.removeEventListener("abort", abort));
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
    const request = Effect.tryPromise({
      try: (signal) => send(input, { ...init, signal }).then(bufferResponse),
      catch: (cause) => AuthRequestFailed.make({ cause }),
    }).pipe(
      Effect.timeoutOrElse({
        duration: NETWORK_ATTEMPT_DEADLINE,
        orElse: () => Effect.fail(AuthRequestDeadline.make()),
      })
    );
    const answer = init.signal
      ? Effect.raceFirst(request, abortedByCaller(init.signal))
      : request;
    return yield* answer;
  }
);

/** The fetch that Better Auth's browser client calls for every request. */
export const authFetch = (input: RequestInfo | URL, init?: RequestInit) =>
  Effect.runPromise(requestWithDeadline(fetch, input, init));
