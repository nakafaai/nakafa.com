import { createLearnerAccount } from "@repo/backend/scripts/content/acceptance/account";
import { LOCAL_AUTH_SECRET } from "@repo/backend/scripts/content/acceptance/auth";
import {
  LocalConvex,
  localConvexLayer,
} from "@repo/backend/scripts/content/acceptance/convex";
import {
  acceptanceRuntimeError,
  retryFunctionTimeout,
} from "@repo/backend/scripts/content/acceptance/error";
import {
  SessionCookie,
  writeFixture,
} from "@repo/backend/scripts/content/acceptance/fixture";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { makeSignature } from "better-auth/crypto";
import { Duration, Effect, Schema } from "effect";

/** Better Auth's session cookie under its default name on plain HTTP. */
const SESSION_COOKIE = "better-auth.session_token";
/** Outlives any browser suite run; the whole runtime is discarded after. */
export const SESSION_LIFETIME = Duration.hours(24);

/**
 * The session cookie of one session token, for a browser to send. Better Auth
 * signs its cookie with HMAC-SHA256 in its own encoding, so Better Auth's own
 * signature function signs it and the cookie is the one it reads.
 */
export const sessionCookieOf = Effect.fn("contentAcceptance.sessionCookie")(
  function* (token: string) {
    const signature = yield* Effect.tryPromise({
      catch: () =>
        acceptanceRuntimeError("The session cookie could not be signed."),
      try: () => makeSignature(token, LOCAL_AUTH_SECRET),
    });
    return {
      name: SESSION_COOKIE,
      value: encodeURIComponent(`${token}.${signature}`),
    };
  }
);

/**
 * Signs one synthetic learner into the running local acceptance backend and
 * answers that learner's session cookie. The learner exists only in this
 * runtime's local database: it is created through Better Auth's own component
 * adapter, gets its app profile from the app's own creation trigger, and
 * receives a session signed with this runtime's inert secret. Each call creates
 * a new learner, so every test starts from a learner without attempts.
 */
export const seedLearner = Effect.fn("contentAcceptance.seedLearner")(
  function* () {
    const { run } = yield* LocalConvex;
    // A loaded machine pushes the local backend past its function time limit, and
    // the learner's setup is not what a browser test checks, so it tries again.
    const { token } = yield* retryFunctionTimeout(
      createLearnerAccount(run, SESSION_LIFETIME)
    );
    return yield* sessionCookieOf(token);
  }
);

/** The usage of the learner mode, which names the file that the session cookie goes to. */
const USAGE = "learner <cookie-file>";
const LearnerArguments = Schema.Tuple([Schema.String]);

/**
 * The learner mode of the acceptance command line: signs one synthetic learner in
 * and writes its session cookie to the file that the command names.
 */
export const learnerMode = {
  mode: "learner",
  usage: USAGE,
  run: Effect.fn("contentAcceptance.runLearner")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [output] = yield* decodeModeArguments(USAGE, LearnerArguments, args);
    const cookie = yield* seedLearner().pipe(
      Effect.provide(localConvexLayer(root))
    );
    yield* writeFixture(output, SessionCookie, cookie);
  }),
} satisfies AcceptanceMode;
