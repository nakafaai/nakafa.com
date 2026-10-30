import {
  createNetworkRequestError,
  NETWORK_RETRY_SCHEDULE,
  type NetworkRequestError,
  type NetworkRetryCodeSchema,
} from "@repo/backend/client/network";
import {
  Array as Arr,
  Duration,
  Effect,
  HashSet,
  Option,
  Schedule,
  Schema,
} from "effect";
import { answerFromAuth, answerWithoutAuth } from "@/lib/auth/answer";
import { bufferResponse } from "@/lib/auth/body";
import { withSessionHint } from "@/lib/auth/hint.server";
import { SESSION_PATH } from "@/lib/auth/session";
import { readRequestHost } from "@/lib/routing/school/host";
import { runServerEffect } from "@/lib/server/fn";

/** One method of the Better Auth route handler that the proxy forwards to. */
type AuthHandlerMethod = (request: Request) => Promise<Response>;

/** The route methods the proxy forwards to. The Better Auth handler serves each HTTP method. */
interface AuthRouteHandler {
  readonly GET: AuthHandlerMethod;
  readonly POST: AuthHandlerMethod;
}

/**
 * The longest a proxied Better Auth request may take, retries included. It is
 * one and a half times the 10 second read attempt because a sign-in or sign-up
 * hashes a password with scrypt and writes a session on the Convex site first.
 */
export const AUTH_PROXY_DEADLINE = Duration.seconds(15);

/**
 * A read is repeated once, and only when its connection was never made. Better
 * Auth serves one-time callbacks over GET, such as `/api/auth/callback/google`,
 * which redeems an authorization code, so a read that failed after its
 * connection may have already acted. The shared schedule gives the 500
 * millisecond wait, and `recurs(1)` stops it after one repeat.
 */
const AUTH_READ_RETRY = Schedule.max([
  NETWORK_RETRY_SCHEDULE,
  Schedule.recurs(1),
]);

type NetworkRetryCode = typeof NetworkRetryCodeSchema.Type;

/**
 * The codes that prove the connection was never made, so the upstream cannot
 * have received the request. ECONNRESET, EPIPE, and UND_ERR_SOCKET are left out
 * on purpose, because the upstream may already have acted when they occur.
 */
const NEVER_CONNECTED_CODES = HashSet.fromIterable<NetworkRetryCode>([
  "ECONNREFUSED",
  "ENOTFOUND",
  "ENETDOWN",
  "ENETUNREACH",
  "EHOSTDOWN",
  "EHOSTUNREACH",
]);

/**
 * Whether a failed read proves that no connection reached the upstream. The
 * failure needs at least one network code, and every code must be a never
 * connected code, so a failure that also carries a reset is not repeated.
 */
function isNeverConnectedError(error: NetworkRequestError) {
  return (
    error.networkCodes.length > 0 &&
    Arr.every(error.networkCodes, (code) =>
      HashSet.has(NEVER_CONNECTED_CODES, code)
    )
  );
}

/** The proxy did not answer within its deadline. */
export class AuthProxyDeadline extends Schema.TaggedError<AuthProxyDeadline>()(
  "AuthProxyDeadline",
  {}
) {}

/**
 * Calls one Better Auth method and reads its whole body, so the deadline covers
 * the body too. The library's own fetch takes no signal, so a deadline ends this
 * wait and does not abort the upstream request or the body read it started.
 */
const callAuthHandler = (send: AuthHandlerMethod, request: Request) =>
  Effect.tryPromise({
    try: () => send(request).then(bufferResponse),
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
 * Forwards one read. A failure that proves the connection was never made is
 * repeated once inside the deadline. Any other failure, including a reset
 * connection, is answered at once, because the upstream may already have acted.
 * A missed deadline is never repeated.
 */
export const readAuthResponse = Effect.fn("www.auth.proxy.read")(function* (
  handler: AuthRouteHandler,
  request: Request
) {
  return yield* callAuthHandler(handler.GET, request).pipe(
    Effect.retry({
      schedule: AUTH_READ_RETRY,
      while: isNeverConnectedError,
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

/** Every failure that the proxy ends with before it becomes an HTTP answer. */
type AuthProxyFailure = NetworkRequestError | AuthProxyDeadline;

/** Answers a missed deadline with a 504 and a JSON error body. */
export const answerAuthDeadline = (
  self: Effect.Effect<Response, AuthProxyFailure>
) =>
  Effect.catchTag(self, "AuthProxyDeadline", () =>
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
 * The request with the host that the browser asked for in its URL. A local
 * `next start` on its own hostname and port builds each request's URL from that
 * address, so every school would read as `localhost`, and the Better Auth handler
 * would forward that name as the browser host. The school of a sign-in would be
 * lost. The `host` header carries the browser's host, as the school routing reads
 * it, and where the URL already names that host, the rewrite changes nothing.
 */
function withBrowserHost(request: Request): Request {
  return Option.match(readRequestHost(request.headers), {
    onNone: () => request,
    onSome: (host) => {
      const url = new URL(request.url);
      url.host = host;
      return new Request(url, request);
    },
  });
}

/**
 * Answers one read: the relay's own answer for a request that sends no
 * credentials (`answerWithoutAuth`), or else Better Auth's, reached with the
 * browser's host (`withBrowserHost`) and given as the browser gets it
 * (`answerFromAuth`).
 */
function answerRead(handler: AuthRouteHandler, request: Request) {
  return Option.match(answerWithoutAuth(request), {
    onNone: () =>
      readAuthResponse(handler, withBrowserHost(request)).pipe(
        Effect.map((response) => answerFromAuth(request, response)),
        answerAuthDeadline
      ),
    onSome: (answer) => Effect.succeed(answer),
  });
}

/**
 * Builds the route methods for the Better Auth handler. A network failure that
 * is not repeated rejects the route, and the server answers 500. Reads go
 * through `answerRead`, and writes reach Better Auth with the browser's host.
 * A session read also keeps the signed-in hint (`withSessionHint`).
 */
export function createAuthProxy(handler: AuthRouteHandler) {
  return {
    GET: (request: Request) =>
      runServerEffect(
        new URL(request.url).pathname === SESSION_PATH
          ? Effect.flatMap(answerRead(handler, request), (response) =>
              withSessionHint(request, response)
            )
          : answerRead(handler, request)
      ),
    POST: (request: Request) =>
      runServerEffect(
        writeAuthResponse(handler, withBrowserHost(request)).pipe(
          answerAuthDeadline
        )
      ),
  };
}
