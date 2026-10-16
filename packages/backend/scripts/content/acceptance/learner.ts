import { createLearnerAccount } from "@repo/backend/scripts/content/acceptance/account";
import { LOCAL_AUTH_SECRET } from "@repo/backend/scripts/content/acceptance/auth";
import { runLocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { readLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import { makeSignature } from "better-auth/crypto";
import { Duration, Effect, FileSystem, Schema } from "effect";

/** Better Auth's session cookie under its default name on plain HTTP. */
const SESSION_COOKIE = "better-auth.session_token";
/** Outlives any browser suite run; the whole runtime is discarded after. */
const SESSION_LIFETIME = Duration.hours(24);
/** The cookie file a browser test reads back before it signs in. */
const SessionCookie = Schema.fromJsonString(
  Schema.Struct({ name: Schema.String, value: Schema.String })
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
      "Run pnpm acceptance:prepare and start acceptance before creating a learner."
    );
  }
  const { token } = yield* createLearnerAccount(
    (operation, args, sensitiveValues) =>
      runLocalConvex(runtime, operation, args, sensitiveValues),
    SESSION_LIFETIME
  );
  // Better Auth signs its cookie with HMAC-SHA256, which Effect's Crypto does
  // not provide, so Better Auth's own signature function signs it.
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
});
