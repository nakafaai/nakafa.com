import type {
  OauthActions,
  OauthProviderRefs,
} from "@convex-dev/auth/methods/oauth/react";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { Effect, Predicate, Schema } from "effect";
import {
  type AuthConvex,
  readAuthClient,
  SIGN_IN_ROUTE,
} from "@/lib/auth/client";
import { SessionTokens } from "@/lib/auth/token";
import { rememberSessionUser } from "@/lib/auth/user";

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
  convex: AuthConvex,
  redirectTo: string
) {
  const client = yield* readAuthClient(convex);
  const actions = client.ambientSignInValues("oauth").get("actions");
  if (!isOauthActions(actions)) {
    return yield* new GoogleSignInFailed();
  }
  const started = yield* Effect.tryPromise({
    catch: () => new GoogleSignInFailed(),
    try: () => actions.signIn(google, { redirectTo }),
  });
  if (started.status !== "redirect") {
    return yield* new GoogleSignInFailed();
  }
});

/** The school login's answer through the sign-in route: a session, or the one refusal. */
const SchoolAnswer = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("complete"),
    tokens: SessionTokens,
  }),
  Schema.Struct({ status: Schema.Literal("error") }),
]);

/** The school login's sign-in, through the sign-in route. */
const schoolSignIn = makeFunctionReference<
  "mutation",
  { loginName: string; password: string; slug: string }
>("auth/school:signIn");

/** The school login's sign-in could not reach the sign-in route, or its answer was unreadable. */
export class SchoolSignInFailed extends Schema.TaggedError<
  SchoolSignInFailed,
  { readonly brand: unique symbol }
>()("SchoolSignInFailed", {}) {}

/**
 * Signs a school login in on its school's host (ADR 0009): the sign-in route
 * forwards it and keeps the refresh token in its cookie, and the page adopts
 * the session. Answers whether it signed in; every refusal reads the same, and
 * an outage fails with `SchoolSignInFailed`.
 */
export const signInSchoolLogin = Effect.fn("www.auth.school")(function* (
  convex: AuthConvex,
  input: {
    readonly loginName: string;
    readonly password: string;
    readonly slug: string;
  }
) {
  const client = yield* readAuthClient(convex);
  const proxy = new ConvexHttpClient(`${SIGN_IN_ROUTE}?path=`, {
    skipConvexDeploymentUrlCheck: true,
  });
  const answer = yield* Effect.tryPromise({
    catch: () => new SchoolSignInFailed(),
    try: () => proxy.mutation(schoolSignIn, input),
  }).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(SchoolAnswer)),
    Effect.mapError(() => new SchoolSignInFailed())
  );
  if (answer.status !== "complete") {
    return false;
  }
  rememberSessionUser(answer.tokens.accessToken, answer.tokens.userId);
  yield* Effect.promise(() => client.setSession(answer.tokens));
  return true;
});
