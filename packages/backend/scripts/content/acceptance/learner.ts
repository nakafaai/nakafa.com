import { createHmac } from "node:crypto";
import { createLearnerAccount } from "@repo/backend/scripts/content/acceptance/account";
import { LOCAL_AUTH_SECRET } from "@repo/backend/scripts/content/acceptance/auth";
import { runAcceptanceCommand } from "@repo/backend/scripts/content/acceptance/command";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import {
  type LocalRuntime,
  readLocalRuntime,
} from "@repo/backend/scripts/content/acceptance/local";
import {
  localConvexEnvironment,
  makeConvexTemporaryRoot,
} from "@repo/backend/scripts/content/acceptance/process";
import { Duration, Effect, FileSystem, Schema } from "effect";

/** Better Auth's session cookie under its default name on plain HTTP. */
const SESSION_COOKIE = "better-auth.session_token";
/** Outlives any browser suite run; the whole runtime is discarded after. */
const SESSION_LIFETIME = Duration.hours(24);
/** The cookie file a browser test reads back before it signs in. */
const SessionCookie = Schema.fromJsonString(
  Schema.Struct({ name: Schema.String, value: Schema.String })
);

/** Runs one Convex CLI command against the running local backend. */
const runLocalConvex = Effect.fn("contentAcceptance.runLocalConvex")(function* (
  runtime: LocalRuntime,
  operation: string,
  args: readonly string[],
  sensitiveValues: readonly string[] = []
) {
  const fs = yield* FileSystem.FileSystem;
  const temporaryRoot = yield* makeConvexTemporaryRoot();
  const output = `${temporaryRoot}/output.json`;
  yield* runAcceptanceCommand({
    args: ["node_modules/convex/bin/main.js", ...args],
    command: process.execPath,
    cwd: runtime.backend,
    env: { ...localConvexEnvironment, TMPDIR: temporaryRoot },
    operation,
    reportStderr: true,
    sensitiveValues,
    stderrPath: `${temporaryRoot}/error.log`,
    stdoutPath: output,
  });
  return yield* fs.readFileString(output);
}, Effect.scoped);

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
  // not provide, so Node's signs it.
  const signature = createHmac("sha256", LOCAL_AUTH_SECRET)
    .update(token)
    .digest("base64");
  const cookie = yield* Schema.encodeEffect(SessionCookie)({
    name: SESSION_COOKIE,
    value: encodeURIComponent(`${token}.${signature}`),
  });
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(output, cookie, { flag: "wx", mode: 0o600 });
});
