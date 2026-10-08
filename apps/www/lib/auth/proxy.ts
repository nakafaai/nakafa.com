import type { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
import {
  createNetworkRequestError,
  isRetryableNetworkError,
  NETWORK_RETRY_SCHEDULE,
  type NetworkRequestError,
} from "@repo/backend/client/network";
import { Duration, Effect, Schedule, Schema } from "effect";

/** One method of the Better Auth route handler that the proxy forwards to. */
type AuthHandlerMethod = (request: Request) => Promise<Response>;

/** The route handler that `@convex-dev/better-auth` returns for Next.js. */
type AuthRouteHandler = ReturnType<typeof convexBetterAuthNextJs>["handler"];

/**
 * The longest a proxied Better Auth request may take, retries included. It is
 * one and a half times the 10 second read attempt because a sign-in or sign-up
 * hashes a password with scrypt and writes a session on the Convex site first.
 */
export const AUTH_PROXY_DEADLINE = Duration.seconds(15);

/**
 * A read that fails on the network is repeated once. The shared schedule gives
 * the 500 millisecond wait, and `recurs(1)` stops it after one repeat, so a
 * read never waits through the shared schedule's second retry.
 */
const AUTH_READ_RETRY = Schedule.max([
  NETWORK_RETRY_SCHEDULE,
  Schedule.recurs(1),
]);

/** The proxy did not answer within its deadline. */
export class AuthProxyDeadline extends Schema.TaggedError<AuthProxyDeadline>()(
  "AuthProxyDeadline",
  {}
) {}

/**
 * Calls one Better Auth method. The library's own fetch takes no signal, so a
 * deadline ends this wait and does not abort the upstream request.
 */
const callAuthHandler = (send: AuthHandlerMethod, request: Request) =>
  Effect.tryPromise({
    try: () => send(request),
    catch: (cause) => createNetworkRequestError(cause),
  });

/** Ends the whole request, retries included, at the proxy deadline. */
const withAuthDeadline = <A>(
  self: Effect.Effect<A, NetworkRequestError>
): Effect.Effect<A, NetworkRequestError | AuthProxyDeadline> =>
  self.pipe(
    Effect.timeoutOrElse({
      duration: AUTH_PROXY_DEADLINE,
      orElse: () => Effect.fail(new AuthProxyDeadline()),
    })
  );

/**
 * Forwards one read. A network failure that Undici classifies as retryable is
 * repeated once inside the deadline. A missed deadline is never repeated.
 */
export const readAuthResponse = Effect.fn("www.auth.proxy.read")(function* (
  handler: AuthRouteHandler,
  request: Request
) {
  return yield* callAuthHandler(handler.GET, request).pipe(
    Effect.retry({
      schedule: AUTH_READ_RETRY,
      while: isRetryableNetworkError,
    }),
    withAuthDeadline
  );
});

/**
 * Forwards one write once. A write is never repeated, because a sign-in, a
 * sign-up, or an account deletion may already have changed state when the
 * network fails.
 */
export const writeAuthResponse = Effect.fn("www.auth.proxy.write")(function* (
  handler: AuthRouteHandler,
  request: Request
) {
  return yield* withAuthDeadline(callAuthHandler(handler.POST, request));
});

/** Answers a missed deadline with a 504 and a JSON error body. */
export const answerAuthDeadline = Effect.catchTag("AuthProxyDeadline", () =>
  Effect.logWarning(
    "The Better Auth route did not answer within its deadline."
  ).pipe(
    Effect.as(
      Response.json(
        {
          code: "AUTH_PROXY_DEADLINE",
          message: "The authentication service did not answer in time.",
        },
        { status: 504 }
      )
    )
  )
);

/**
 * Builds the Next.js route methods for the Better Auth handler. A network
 * failure that is not repeated rejects the route, and Next.js answers 500, as it
 * did before the proxy existed.
 */
export function createAuthProxy(handler: AuthRouteHandler) {
  return {
    GET: (request: Request) =>
      Effect.runPromise(
        readAuthResponse(handler, request).pipe(answerAuthDeadline)
      ),
    POST: (request: Request) =>
      Effect.runPromise(
        writeAuthResponse(handler, request).pipe(answerAuthDeadline)
      ),
  };
}
