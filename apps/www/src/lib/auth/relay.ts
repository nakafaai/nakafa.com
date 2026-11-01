import { Effect, Option } from "effect";
import { answerFromAuth, answerWithoutAuth } from "@/lib/auth/answer";
import { withSessionHint } from "@/lib/auth/hint.server";
import {
  type AuthRouteHandler,
  answerAuthDeadline,
  readAuthResponse,
  writeAuthResponse,
} from "@/lib/auth/upstream";
import { readRequestHost } from "@/lib/routing/school/host";
import { runServerEffect } from "@/lib/server/fn";

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
 * The request with an empty JSON body when it sends nothing at all. Better Auth's session refresh
 * posts no body, and Convex gives every action's request a body stream, so Better Auth would
 * refuse the refresh with 415 for naming no media type, and a session would end on its date
 * however active its owner is.
 */
function withJsonBody(request: Request): Request {
  if (
    request.headers.has("content-type") ||
    (request.headers.get("content-length") ?? "0") !== "0"
  ) {
    return request;
  }
  const headers = new Headers(request.headers);
  headers.set("content-type", "application/json");
  return new Request(request, { body: "{}", headers });
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
 * Logs why a Better Auth route failed, with the whole cause and the route's
 * path, before the failure rejects the route. The server then answers 500 with
 * an empty body, so this log is the only place that names the failure.
 */
function logRouteFailure(request: Request) {
  return <A, E, R>(self: Effect.Effect<A, E, R>) =>
    Effect.tapCause(self, (cause) =>
      Effect.logError(
        `The Better Auth route ${request.method} ${new URL(request.url).pathname} failed before it answered.`,
        cause
      )
    );
}

/**
 * Builds the route methods for the Better Auth handler. A network failure that
 * is not repeated rejects the route, and the server answers 500, after the
 * failure is logged (`logRouteFailure`). Reads go through `answerRead`, and
 * writes reach Better Auth with the browser's host. Every answer keeps the
 * signed-in hint (`withSessionHint`).
 */
export function createAuthProxy(handler: AuthRouteHandler) {
  return {
    GET: (request: Request) =>
      runServerEffect(
        answerRead(handler, request).pipe(
          Effect.flatMap((response) => withSessionHint(request, response)),
          logRouteFailure(request)
        )
      ),
    POST: (request: Request) =>
      runServerEffect(
        writeAuthResponse(handler, withJsonBody(withBrowserHost(request))).pipe(
          answerAuthDeadline,
          Effect.flatMap((response) => withSessionHint(request, response)),
          logRouteFailure(request)
        )
      ),
  };
}
