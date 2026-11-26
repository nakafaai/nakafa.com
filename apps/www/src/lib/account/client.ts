import type { Ref } from "@confect/core";
import { ConvexHttpClient } from "convex/browser";
import { Effect, Option, Predicate } from "effect";
import { clientEnv } from "@/env.public";
import { reportClientException } from "@/lib/analytics/client";
import { hasSignedInHint } from "@/lib/auth/hint";
import { readBrowserSession } from "@/lib/auth/token";
import { readMadeClient } from "@/lib/convex/client";
import { failAtGateway } from "@/lib/convex/http";
import type { QueryClient } from "@/lib/convex/read";
import { readQueryOn } from "@/lib/convex/read";

/** Whether a failed read is a transport or decoding failure rather than a typed query refusal. */
const isQueryReadFailed = Predicate.isTagged("QueryReadFailed");

/** Creates one browser HTTP Convex client with gateway-failure detection. */
function createBrowserHttpClient(token?: string): QueryClient {
  const http = new ConvexHttpClient(clientEnv.VITE_CONVEX_URL, {
    fetch: failAtGateway(fetch),
  });
  if (token !== undefined) {
    http.setAuth(token);
  }
  return http;
}

/**
 * Resolves the authenticated Convex client for a signed-in account screen
 * (`_account`). On SPA navigation inside the app shell, the page's live
 * WebSocket client is already open and authenticated, so queries run directly
 * over it with zero Worker requests and zero token refreshes (ADR 0038 D2).
 * On a cold load before the shell mounts, the browser refreshes its session
 * once and reads Convex directly over HTTP.
 */
export const resolveAccountClient = Effect.fn("www.account.resolveClient")(
  function* (origin: string) {
    const live = readMadeClient();
    if (Option.isSome(live)) {
      return Option.some<QueryClient>(live.value);
    }
    const session = yield* readBrowserSession(origin);
    if (session === null) {
      return Option.none<QueryClient>();
    }
    return Option.some(createBrowserHttpClient(session.accessToken));
  }
);

/**
 * Resolves a browser Convex client for screens that serve both signed-in
 * learners and signed-out visitors (such as public profiles under `_app`).
 * Signed-in navigations reuse the live WebSocket client; visitors read
 * directly over an unauthenticated HTTP client with no refresh call.
 */
export const resolveBrowserClient = Effect.fn(
  "www.account.resolveBrowserClient"
)(function* (cookie: string, origin: string) {
  const live = readMadeClient();
  if (Option.isSome(live)) {
    const client: QueryClient = live.value;
    return { client, signedIn: true };
  }
  if (hasSignedInHint(cookie)) {
    const session = yield* readBrowserSession(origin);
    if (session !== null) {
      return {
        client: createBrowserHttpClient(session.accessToken),
        signedIn: true,
      };
    }
  }
  return { client: createBrowserHttpClient(), signedIn: false };
});

/**
 * Reads one optional section in the browser. A typed refusal leaves the
 * section empty silently; an unexpected transport or decoding failure is
 * reported and leaves the section empty so one widget never blocks a screen.
 */
export const readAccountOptional = Effect.fn("www.account.readOptional")(
  function* <Query extends Ref.AnyPublicQuery>(
    client: QueryClient,
    ref: Query,
    args: Ref.Args<Query>,
    source: string
  ) {
    return yield* readQueryOn(client, ref, args).pipe(
      Effect.catch((error) =>
        isQueryReadFailed(error)
          ? reportClientException(error, {
              operation: ref.convexFunctionName,
              source,
            }).pipe(Effect.as(undefined))
          : Effect.undefined
      )
    );
  }
);

/**
 * Reads one required query in the browser. Transport and decoding failures
 * (`QueryReadFailed`) remain failures for the route's error boundary;
 * `SessionRequired` maps to `SignedOut`; any other typed refusal maps to
 * `NotFound`.
 */
export const readAccountRequired = Effect.fn("www.account.readRequired")(
  function* <Query extends Ref.AnyPublicQuery>(
    client: QueryClient,
    ref: Query,
    args: Ref.Args<Query>
  ) {
    return yield* readQueryOn(client, ref, args).pipe(
      Effect.map((value) => ({ _tag: "Value" as const, value })),
      Effect.catchIf(
        (error) => !isQueryReadFailed(error),
        (error) =>
          Effect.succeed(
            Predicate.isTagged(error, "SessionRequired")
              ? ({ _tag: "SignedOut" } as const)
              : ({ _tag: "NotFound" } as const)
          )
      )
    );
  }
);
