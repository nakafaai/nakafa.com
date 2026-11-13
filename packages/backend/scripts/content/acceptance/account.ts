import { decodeAccessToken } from "@convex-dev/auth/ssr";
import type { RunConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { Effect, Schema } from "effect";
import { SecureRandom } from "effect/crypto";
import { Hex } from "effect/encoding";

/** What the acceptance seed answers: the account and the password it signs in with. */
const SeededAccount = Schema.Struct({
  password: Schema.String,
  userId: Schema.String,
});

/** What Convex Auth's password sign-in answers when it made a session. */
const SignedIn = Schema.Struct({
  status: Schema.Literal("complete"),
  tokens: Schema.Struct({
    accessToken: Schema.String,
    refreshToken: Schema.String,
  }),
});

/** The claims of a session's access token that name it: its subject is the session. */
const SessionClaims = Schema.Struct({ sub: Schema.String });

/**
 * The cookies of a Convex Auth session, as the web app's sign-in route sets
 * them: the access token, and the refresh token the server refreshes with.
 * https://docs.convex.dev/auth/convex-auth/ssr-nextjs/setup
 */
const sessionCookiesOf = (tokens: (typeof SignedIn.Type)["tokens"]) => [
  { name: "__convexAuthJWT", value: tokens.accessToken },
  { name: "__convexAuthRefreshToken", value: tokens.refreshToken },
];

/**
 * Signs in the account that holds `address`, made first when no account holds
 * it, or a new synthetic learner when there is no address, so every caller
 * without one starts from a learner without history. The acceptance seed gives
 * the account a fresh password, and Convex Auth's password method signs it in,
 * so the session is one the deployment made. Answers the account, its
 * session and the session's cookies.
 */
export const openLearnerAccount = Effect.fn(
  "contentAcceptance.openLearnerAccount"
)(function* <E, R>(run: RunConvex<E, R>, address?: string) {
  const id = Hex.encode(
    yield* (yield* SecureRandom.SecureRandom).randomBytes(8)
  );
  const seeded = yield* run("Learner account", {
    args: {
      email: address ?? `learner-${id}@acceptance.invalid`,
      name: "Acceptance Learner",
    },
    path: "acceptance/accounts:create",
  }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(SeededAccount)));
  return yield* signInAccount(run, seeded);
});

/** Signs a seeded account in with its password, and answers the account, its session and the session's cookies. */
export const signInAccount = Effect.fn("contentAcceptance.signInAccount")(
  function* <E, R>(run: RunConvex<E, R>, account: typeof SeededAccount.Type) {
    const signed = yield* run("Learner sign-in", {
      args: { password: account.password, username: account.userId },
      path: "auth/core:signInWithUsernamePassword",
    }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(SignedIn)));
    const { sub } = yield* Schema.decodeUnknownEffect(SessionClaims)(
      decodeAccessToken(signed.tokens.accessToken)
    );
    return {
      cookies: sessionCookiesOf(signed.tokens),
      sessionId: sub,
      userId: account.userId,
    };
  }
);
