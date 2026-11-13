import { AuthClient, defaultStorage } from "@convex-dev/auth/browser";
import { oauth } from "@convex-dev/auth/methods/oauth/react";
import { FetchClient } from "@repo/utilities/http/client";
import { ConvexHttpClient } from "convex/browser";
import type { ConvexReactClient } from "convex/react";
import { Effect, Option, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import { readBrowserSession, SessionTokens } from "@/lib/auth/token";
import { rememberSessionUser } from "@/lib/auth/user";

/** The web app's sign-in and sign-out routes (`routes/api/auth`), which keep the refresh token in a cookie. */
export const SIGN_IN_ROUTE = "/api/auth/signin";
const SIGN_OUT_ROUTE = "/api/auth/signout";

/** What Convex Auth's client uses of the page's Convex client: its address, and its mutations for Google's start. */
export type AuthConvex = Pick<ConvexReactClient, "mutation" | "url">;

/** A sign-in's answer that made a session, whose account the session store keeps. */
const SignedIn = Schema.Struct({
  status: Schema.Literal("complete"),
  tokens: SessionTokens,
});

/** The sign-out route did not answer, so the session's cookies may still stand. */
export class SignOutFailed extends Schema.TaggedError<
  SignOutFailed,
  { readonly brand: unique symbol }
>()("SignOutFailed", {}) {}

/**
 * Asks the sign-out route of the page's own host to end the session and clear
 * its cookies. Only an answer that the route gave counts.
 */
const endSession = Effect.fn("www.auth.endSession")(
  function* () {
    const client = (yield* HttpClient.HttpClient).pipe(
      HttpClient.filterStatusOk,
      HttpClient.withScope
    );
    yield* client
      .execute(
        HttpClientRequest.post(
          new URL(SIGN_OUT_ROUTE, window.location.origin)
        ).pipe(HttpClientRequest.bodyJson({}))
      )
      .pipe(Effect.mapError(() => new SignOutFailed()));
  },
  Effect.scoped,
  Effect.provide(FetchClient)
);

/**
 * Creates the page's Convex Auth client in its SSR mode: the refresh token
 * stays in an httpOnly cookie that only the web app's routes read, and the
 * browser holds the access token alone. The sign-ins go through the sign-in
 * route, which moves the new refresh token into the cookie; Google's completion
 * runs by itself when the browser comes back with its code (`oauth()`). A
 * refresh that cannot reach the route fails, so Convex Auth keeps the session
 * it holds instead of signing the learner out.
 * https://docs.convex.dev/auth/convex-auth/ssr-nextjs/setup
 */
function createAuthClient(convex: AuthConvex) {
  const proxy = new ConvexHttpClient(`${SIGN_IN_ROUTE}?path=`, {
    skipConvexDeploymentUrlCheck: true,
  });
  let client: AuthClient;
  const withAuth = () => {
    const token = client.getAccessToken();
    if (token === null) {
      proxy.clearAuth();
    } else {
      proxy.setAuth(token);
    }
    return proxy;
  };
  client = new AuthClient({
    ambientSignIns: {
      convex: { mutation: (fn, args) => convex.mutation(fn, args) },
      replaceUrl: (url) =>
        window.history.replaceState(window.history.state, "", url),
      signInApi: {
        action: (fn, args) => withAuth().action(fn, args),
        mutation: (fn, args) =>
          withAuth()
            .mutation(fn, args)
            .then((answer) => {
              const signedIn = Schema.decodeUnknownOption(SignedIn)(answer);
              if (Option.isSome(signedIn)) {
                rememberSessionUser(
                  signedIn.value.tokens.accessToken,
                  signedIn.value.tokens.userId
                );
              }
              return answer;
            }),
      },
      signIns: [oauth()],
    },
    authApi: {
      refreshSession: () =>
        Effect.runPromise(
          readBrowserSession(window.location.origin).pipe(
            Effect.tap((session) =>
              Effect.sync(() => {
                if (session !== null) {
                  rememberSessionUser(session.accessToken, session.userId);
                }
              })
            )
          )
        ),
      signOut: () => Effect.runPromise(endSession()),
    },
    mode: "ssr",
    storage: defaultStorage(),
    storageNamespace: convex.url,
  });
  return client;
}

/** The page's Convex Auth client and its start, made on first use so a visitor's page makes none. */
let shared:
  | { readonly client: AuthClient; readonly ready: Promise<void> }
  | undefined;

/** Returns the page's Convex Auth client for its Convex client once it has started. */
export const readAuthClient = Effect.fn("www.auth.client")(function* (
  convex: AuthConvex
) {
  if (shared === undefined) {
    const client = createAuthClient(convex);
    shared = { client, ready: client.init() };
  }
  const { client, ready } = shared;
  yield* Effect.promise(() => ready);
  return client;
});

/**
 * Signs the page's session out: the sign-out route ends it and clears its
 * cookies, and only then does Convex Auth's client forget its access token.
 * The client forgets it only through its own sign-out, which asks the route
 * once more; that second answer finds no session and changes nothing.
 */
export const signOutSession = Effect.fn("www.auth.signOut")(function* (
  convex: AuthConvex
) {
  const client = yield* readAuthClient(convex);
  yield* endSession();
  yield* Effect.promise(() => client.signOut());
});
