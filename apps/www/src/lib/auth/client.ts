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
import { Effect, Option, Predicate, Schema } from "effect";
import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "effect/http";
import { createStore } from "zustand/vanilla";
import { readTokenClaims } from "@/lib/auth/claims";
import { SESSION_USER_KEY } from "@/lib/auth/keys";
import { type AuthSession, readClientSession } from "@/lib/auth/session";

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
  tokens: Schema.Struct({ accessToken: Schema.String, userId: Schema.String }),
});

/** The account of one session, as a sign-in's or a refresh's answer names it. */
const SessionUser = Schema.Struct({
  sessionId: Schema.String,
  userId: Schema.String,
});

/** The account the browser stored for its last session, or none when storage holds none or refuses. */
const loadSessionUser = () =>
  Effect.runSync(
    Effect.try(() => window.localStorage.getItem(SESSION_USER_KEY)).pipe(
      Effect.map((text) =>
        Option.getOrNull(
          Option.flatMap(
            Option.fromNullOr(text),
            Schema.decodeOption(Schema.fromJsonString(SessionUser))
          )
        )
      ),
      Effect.orElseSucceed(() => null)
    )
  );

/**
 * The account of the page's session: Convex Auth's access token names only the
 * session, and the answers of a sign-in or a refresh name the account. One store
 * for the page, which starts from the account the browser stored.
 */
export const sessionUser = createStore<{
  readonly user: typeof SessionUser.Type | null;
}>(() => ({ user: typeof window === "undefined" ? null : loadSessionUser() }));

/** Keeps the account an answer named, for this page and the next one. */
function rememberSessionUser(accessToken: string, userId: string) {
  const sessionId = Option.getOrNull(
    Option.map(readTokenClaims(accessToken), ({ sub }) => sub)
  );
  if (sessionId === null) {
    return;
  }
  const user = SessionUser.make({ sessionId, userId });
  sessionUser.setState({ user });
  Effect.runSync(
    Effect.try(() =>
      window.localStorage.setItem(
        SESSION_USER_KEY,
        Schema.encodeSync(Schema.fromJsonString(SessionUser))(user)
      )
    ).pipe(Effect.ignore)
  );
}

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
    if (answer !== null) {
      rememberSessionUser(answer.accessToken, answer.userId);
    }
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
  rememberSessionUser(answer.tokens.accessToken, answer.tokens.userId);
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

/** A session the page's readers follow: it reports each change to a listener until the listener is unsubscribed. */
export interface SessionFeed {
  readonly subscribe: (listener: (session: AuthSession) => void) => () => void;
}

/**
 * The page's session as Convex Auth's client settles it, for the session
 * stores to follow. A page whose browser holds no access token asks the
 * refresh route once, which answers from the refresh cookie, and reads as
 * pending until it answers, so a signed-in page never flashes signed out.
 */
export function followClientSession(convex: ConvexReactClient): SessionFeed {
  return {
    subscribe: (listener) => {
      let closed = false;
      let release = () => undefined;
      Effect.runFork(
        readAuthClient(convex).pipe(
          Effect.tap((client) =>
            Effect.sync(() => {
              if (closed) {
                return;
              }
              let primed = client.getAccessToken() !== null;
              const emit = () => {
                const snapshot = client.getSnapshot();
                const user = sessionUser.getState().user;
                const session = readClientSession(
                  {
                    isLoading: snapshot.isLoading || !primed,
                    token: snapshot.token,
                  },
                  null
                );
                listener(
                  user !== null && user.sessionId === session.sessionId
                    ? { ...session, userId: user.userId }
                    : session
                );
              };
              const offClient = client.subscribe(emit);
              const offUser = sessionUser.subscribe(emit);
              release = () => {
                offClient();
                offUser();
              };
              emit();
              if (!primed) {
                client
                  .fetchAccessToken({ forceRefreshToken: true })
                  .finally(() => {
                    primed = true;
                    emit();
                  });
              }
            })
          )
        )
      );
      return () => {
        closed = true;
        release();
      };
    },
  };
}
