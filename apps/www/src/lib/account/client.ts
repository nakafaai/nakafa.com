import type { Ref } from "@confect/core";
import { ConvexHttpClient } from "convex/browser";
import { Clock, Effect, Option, Predicate } from "effect";
import { clientEnv } from "@/env.public";
import { reportClientException } from "@/lib/analytics/client";
import { readTokenClaims } from "@/lib/auth/claims";
import type { AuthConvex } from "@/lib/auth/client";
import { readAuthClient } from "@/lib/auth/client";
import { hasSignedInHint } from "@/lib/auth/hint";
import { readConvexClient, readMadeClient } from "@/lib/convex/client";
import { failAtGateway } from "@/lib/convex/http";
import type { QueryClient } from "@/lib/convex/read";
import { QueryReadFailed, readQueryOn } from "@/lib/convex/read";

/** Whether a failed read is a transport or decoding failure rather than a typed query refusal. */
const isQueryReadFailed = Predicate.isTagged("QueryReadFailed");

/** Margin before JWT expiry where a cached browser token is refreshed before use. */
const TOKEN_REFRESH_MARGIN_MILLISECONDS = 30_000;

/**
 * Lazy Convex bridge for `readAuthClient` on a cold load before `PageProviders`
 * mounts the live socket (`readMadeClient`). Its `mutation` runs only if an
 * ambient OAuth sign-in executes, so calling `readAuthClient` never creates
 * `shared` prematurely before `LiveCredentials` mounts.
 */
function lazyAuthConvex(): AuthConvex {
  return {
    mutation: (mutation, ...argsAndOptions) =>
      readConvexClient(clientEnv.VITE_CONVEX_URL).mutation(
        mutation,
        ...argsAndOptions
      ),
    url: clientEnv.VITE_CONVEX_URL,
  };
}

/** Whether a cached access token still has time left before expiry. */
function isFreshToken(token: string, nowMillis: number): boolean {
  return Option.exists(
    readTokenClaims(token),
    ({ exp }) => exp * 1000 > nowMillis + TOKEN_REFRESH_MARGIN_MILLISECONDS
  );
}

/**
 * Reads a usable Convex access token through the page's single `AuthClient`:
 * reuses a fresh cached JWT from browser storage with zero network requests,
 * or refreshes once under `AuthClient`'s cross-tab mutex so concurrent tabs
 * and `PageProviders` never race `POST /api/auth/refresh` on the same refresh
 * cookie.
 */
const readSessionToken = Effect.fn("www.account.readSessionToken")(
  function* () {
    const auth = yield* readAuthClient(lazyAuthConvex());
    const held = auth.getAccessToken();
    if (held !== null) {
      const now = yield* Clock.currentTimeMillis;
      if (isFreshToken(held, now)) {
        return held;
      }
    }
    return yield* Effect.tryPromise({
      catch: (cause) => new QueryReadFailed({ cause }),
      try: () => auth.fetchAccessToken({ forceRefreshToken: true }),
    });
  }
);

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
 * On a cold load before the shell mounts, the browser reuses its cached access
 * token or refreshes once through `AuthClient`'s mutex and reads Convex
 * directly over HTTP.
 */
export const resolveAccountClient = Effect.fn("www.account.resolveClient")(
  function* () {
    const live = readMadeClient();
    if (Option.isSome(live)) {
      return Option.some<QueryClient>(live.value);
    }
    const token = yield* readSessionToken();
    if (token === null) {
      return Option.none<QueryClient>();
    }
    return Option.some(createBrowserHttpClient(token));
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
)(function* (cookie: string) {
  const live = readMadeClient();
  if (Option.isSome(live)) {
    const client: QueryClient = live.value;
    return { client, signedIn: true };
  }
  if (hasSignedInHint(cookie)) {
    const token = yield* readSessionToken();
    if (token !== null) {
      return {
        client: createBrowserHttpClient(token),
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
