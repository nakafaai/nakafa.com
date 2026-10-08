import { NETWORK_ATTEMPT_DEADLINE } from "@repo/backend/client/network";
import { Effect, Schema } from "effect";

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
 * Sends one Better Auth request under the shared attempt deadline, and aborts it
 * when the caller aborts.
 *
 * Better-fetch arms its own `timeout` only for a request without a signal, and
 * Better Auth's session read always sends one. The deadline therefore lives here,
 * where every request passes. The abort closes the request at the deadline.
 */
export const requestWithDeadline = Effect.fn("www.auth.requestWithDeadline")(
  function* (
    send: typeof fetch,
    input: RequestInfo | URL,
    init: RequestInit = {}
  ) {
    const controller = new AbortController();
    const caller = init.signal;
    const abortRequest = () => controller.abort();
    if (caller?.aborted) {
      controller.abort();
    }
    caller?.addEventListener("abort", abortRequest, { once: true });

    return yield* Effect.tryPromise({
      try: () => send(input, { ...init, signal: controller.signal }),
      catch: (cause) => new AuthRequestFailed({ cause }),
    }).pipe(
      Effect.timeoutOrElse({
        duration: NETWORK_ATTEMPT_DEADLINE,
        orElse: () =>
          Effect.sync(() => controller.abort()).pipe(
            Effect.andThen(Effect.fail(new AuthRequestDeadline()))
          ),
      }),
      Effect.ensuring(
        Effect.sync(() => caller?.removeEventListener("abort", abortRequest))
      )
    );
  }
);

/** The fetch that Better Auth's browser client calls for every request. */
export const authFetch = (input: RequestInfo | URL, init?: RequestInit) =>
  Effect.runPromise(requestWithDeadline(fetch, input, init));
