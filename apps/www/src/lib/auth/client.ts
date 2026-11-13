import {
  AuthClient,
  type AuthSessionResponse,
  defaultStorage,
} from "@convex-dev/auth/browser";
import {
  type OauthActions,
  type OauthProviderRefs,
  oauth,
} from "@convex-dev/auth/methods/oauth/react";
import { FetchClient } from "@repo/utilities/http/client";
import { ConvexHttpClient } from "convex/browser";
import type { ConvexReactClient } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { Effect, Predicate, Schema } from "effect";
import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/http";
import { createStore } from "zustand/vanilla";

/** The web app's Convex Auth routes (`routes/api/auth`), which keep the refresh token in a cookie. */
const SIGN_IN_ROUTE = "/api/auth/signin";
const REFRESH_ROUTE = "/api/auth/refresh";
const SIGN_OUT_ROUTE = "/api/auth/signout";

/** What the refresh and sign-out routes answer: the access token and its user, or none. */
const SessionAnswer = Schema.Struct({
  tokens: Schema.NullOr(
    Schema.Struct({ accessToken: Schema.String, userId: Schema.String })
  ),
});

/** A sign-in's answer that made a session, whose user the session store keeps. */
const SignedIn = Schema.Struct({
  status: Schema.Literal("complete"),
  tokens: Schema.Struct({ userId: Schema.String }),
});

/**
 * The account of the page's session, as the latest sign-in or refresh named
 * it: Convex Auth's access token names only the session, and its answers name
 * the user. One store for the page, created on first use.
 */
export const sessionUser = createStore<{ readonly userId: string | null }>(
  () => ({ userId: null })
);

/**
 * Posts to one of the auth routes and reads its answer. An answer that cannot
 * be read is no session, as Convex Auth reads one.
 */
const postAuth = Effect.fn("www.auth.post")(
  function* (route: string) {
    const client = (yield* HttpClient.HttpClient).pipe(HttpClient.withScope);
    const answer = yield* client
      .execute(
        HttpClientRequest.post(new URL(route, window.location.href).href).pipe(
          HttpClientRequest.bodyJson({})
        )
      )
      .pipe(
        Effect.flatMap(HttpClientResponse.schemaBodyJson(SessionAnswer)),
        Effect.map(({ tokens }) => tokens),
        Effect.orElseSucceed(() => null)
      );
    sessionUser.setState({ userId: answer?.userId ?? null });
    const response: AuthSessionResponse = { tokens: answer };
    return response;
  },
  Effect.scoped,
  Effect.provide(FetchClient)
);

/**
 * Creates the page's Convex Auth client in its SSR mode: the refresh token
 * stays in an httpOnly cookie that only the web app's routes read, and the
 * browser holds the access token alone. The sign-ins go through the sign-in
 * route, which moves the new refresh token into the cookie; Google's completion
 * runs by itself when the browser comes back with its code (`oauth()`).
 * https://docs.convex.dev/auth/convex-auth/ssr-nextjs/setup
 */
function createAuthClient(convex: ConvexReactClient) {
  const proxy = new ConvexHttpClient(`${SIGN_IN_ROUTE}?path=`, {
    logger: convex.logger,
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
              if (signedIn._tag === "Some") {
                sessionUser.setState({ userId: signedIn.value.tokens.userId });
              }
              return answer;
            }),
      },
      signIns: [oauth()],
    },
    authApi: {
      refreshSession: () =>
        Effect.runPromise(
          postAuth(REFRESH_ROUTE).pipe(Effect.map(({ tokens }) => tokens))
        ),
      signOut: () => Effect.runPromise(Effect.asVoid(postAuth(SIGN_OUT_ROUTE))),
    },
    mode: "ssr",
    storage: defaultStorage(),
    storageNamespace: convex.url,
  });
  return client;
}

/** The page's Convex Auth client, created on first use so a visitor's page creates none. */
let shared: AuthClient | undefined;

/** Returns the page's Convex Auth client for its Convex client, and starts it once. */
export const readAuthClient = Effect.fn("www.auth.client")(function* (
  convex: ConvexReactClient
) {
  if (shared !== undefined) {
    return shared;
  }
  const client = createAuthClient(convex);
  shared = client;
  yield* Effect.promise(() => client.init());
  return client;
});

/** Convex Auth's Google functions, which the sign-in starts and the return completes. */
const google = {
  completeSignIn: makeFunctionReference<
    "mutation",
    { code: string; state: string }
  >("auth/core:completeSignInWithGoogle"),
  providerName: "google",
  startSignIn: makeFunctionReference<
    "mutation",
    { redirectTo: string },
    { redirect: string; state: string }
  >("auth/core:startSignInWithGoogle"),
} satisfies OauthProviderRefs;

/** Whether a value the oauth sign-in published is its actions (`OauthActions`). */
const isOauthActions = (value: unknown): value is OauthActions =>
  Predicate.hasProperty(value, "signIn") && Predicate.isFunction(value.signIn);

/** Google's sign-in could not start, so the page stays where it is. */
export class GoogleSignInFailed extends Schema.TaggedError<
  GoogleSignInFailed,
  { readonly brand: unique symbol }
>()("GoogleSignInFailed", {}) {}

/**
 * Starts Google's sign-in and leaves for Google. Google returns to
 * `redirectTo`, an address of the main site (a school host signs in there,
 * ADR 0026), where the page's client completes the sign-in by itself.
 */
export const startGoogleSignIn = Effect.fn("www.auth.google")(function* (
  convex: ConvexReactClient,
  redirectTo: string
) {
  const client = yield* readAuthClient(convex);
  const actions = client.ambientSignInValues("oauth").get("actions");
  if (!isOauthActions(actions)) {
    return yield* new GoogleSignInFailed();
  }
  const started = yield* Effect.promise(() =>
    actions.signIn(google, { redirectTo })
  );
  if (started.status !== "redirect") {
    return yield* new GoogleSignInFailed();
  }
});

/** The school login's answer through the sign-in route: a session, or the one refusal. */
const SchoolAnswer = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("complete"),
    tokens: Schema.Struct({ accessToken: Schema.String, userId: Schema.String }),
  }),
  Schema.Struct({ status: Schema.Literal("error") }),
]);

/** The school login's sign-in, through the sign-in route. */
const schoolSignIn = makeFunctionReference<
  "mutation",
  { loginName: string; password: string; slug: string }
>("auth/school:signIn");

/**
 * Signs a school login in on its school's host (ADR 0009): the sign-in route
 * forwards it and keeps the refresh token in its cookie, and the page adopts
 * the session. Answers whether it signed in; every refusal reads the same.
 */
export const signInSchoolLogin = Effect.fn("www.auth.school")(function* (
  convex: ConvexReactClient,
  input: { readonly loginName: string; readonly password: string; readonly slug: string }
) {
  const client = yield* readAuthClient(convex);
  const proxy = new ConvexHttpClient(`${SIGN_IN_ROUTE}?path=`, {
    skipConvexDeploymentUrlCheck: true,
  });
  const answer = yield* Effect.promise(() =>
    proxy.mutation(schoolSignIn, input)
  ).pipe(Effect.flatMap(Schema.decodeUnknownEffect(SchoolAnswer)), Effect.orDie);
  if (answer.status !== "complete") {
    return false;
  }
  sessionUser.setState({ userId: answer.tokens.userId });
  yield* Effect.promise(() => client.setSession(answer.tokens));
  return true;
});

/** Signs the page's session out: the sign-out route ends it and clears its cookies. */
export const signOutSession = Effect.fn("www.auth.signOut")(function* (
  convex: ConvexReactClient
) {
  const client = yield* readAuthClient(convex);
  yield* Effect.promise(() => client.signOut());
});
