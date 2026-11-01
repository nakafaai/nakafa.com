import { createLearnerAccount } from "@repo/backend/scripts/content/acceptance/account";
import { LOCAL_AUTH_SECRET } from "@repo/backend/scripts/content/acceptance/auth";
import { runLocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import {
  acceptanceRuntimeError,
  retryFunctionTimeout,
} from "@repo/backend/scripts/content/acceptance/error";
import { SessionCookie } from "@repo/backend/scripts/content/acceptance/fixture";
import { readLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { makeSignature } from "better-auth/crypto";
import { Duration, Effect, FileSystem, Schema } from "effect";

/** Better Auth's session cookie under its default name on plain HTTP. */
const SESSION_COOKIE = "better-auth.session_token";
/** Outlives any browser suite run; the whole runtime is discarded after. */
export const SESSION_LIFETIME = Duration.hours(24);

/**
 * Writes the session cookie of one session token, mode 600, for a browser test
 * to send. Better Auth signs its cookie with HMAC-SHA256 in its own encoding, so
 * Better Auth's own signature function signs it and the cookie is the one it reads.
 */
export const writeSessionCookie = Effect.fn("contentAcceptance.writeCookie")(
  function* (output: string, token: string) {
    const signature = yield* Effect.tryPromise({
      catch: () =>
        acceptanceRuntimeError("The session cookie could not be signed."),
      try: () => makeSignature(token, LOCAL_AUTH_SECRET),
    });
    const cookie = yield* Schema.encodeEffect(SessionCookie)({
      name: SESSION_COOKIE,
      value: encodeURIComponent(`${token}.${signature}`),
    });
    const fs = yield* FileSystem.FileSystem;
    yield* fs.writeFileString(output, cookie, { flag: "wx", mode: 0o600 });
  }
);

/**
 * Signs one synthetic learner into the running local acceptance backend and
 * writes that learner's session cookie, mode 600, for a browser test to send.
 * The learner exists only in this runtime's local database: it is created
 * through Better Auth's own component adapter, gets its app profile from the
 * app's own creation trigger, and receives a session signed with this
 * runtime's inert secret. Each call creates a new learner, so every test
 * starts from a learner without attempts.
 */
export const createAcceptanceLearner = Effect.fn(
  "contentAcceptance.createLearner"
)(function* (root: string, output: string) {
  const runtime = yield* readLocalRuntime(root);
  if (runtime === undefined) {
    return yield* acceptanceRuntimeError(
      "Run bun run acceptance:prepare and start acceptance before creating a learner."
    );
  }
  // A loaded machine pushes the local backend past its function time limit, and
  // the learner's setup is not what a browser test checks, so it tries again.
  const { token } = yield* retryFunctionTimeout(
    createLearnerAccount(
      (operation, args, sensitiveValues) =>
        runLocalConvex(runtime, operation, args, sensitiveValues),
      SESSION_LIFETIME
    )
  );
  yield* writeSessionCookie(output, token);
});

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
    return yield* createAcceptanceLearner(root, output);
  }),
} satisfies AcceptanceMode;
