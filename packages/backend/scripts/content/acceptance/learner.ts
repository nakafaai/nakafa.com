import { createHmac } from "node:crypto";
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
import { JsonTextSchema } from "@repo/utilities/json";
import { Clock, Crypto, Effect, FileSystem, Schema } from "effect";
import { Base64Url, Hex } from "effect/encoding";

/** Better Auth's session cookie under its default name on plain HTTP. */
const SESSION_COOKIE = "better-auth.session_token";
/** Outlives any browser suite run; the whole runtime is discarded after. */
const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000;
const CreatedDocument = Schema.fromJsonString(
  Schema.Struct({ _creationTime: Schema.Finite, _id: Schema.String })
);
/** The cookie file a browser test reads back before it signs in. */
const SessionCookie = Schema.fromJsonString(
  Schema.Struct({ name: Schema.String, value: Schema.String })
);
/** One Convex function's arguments as the CLI takes them, JSON text. */
const encodeArguments = Schema.encodeEffect(JsonTextSchema);

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
  const now = yield* Clock.currentTimeMillis;
  const crypto = yield* Crypto.Crypto;
  const id = Hex.encode(yield* crypto.randomBytes(8));
  const token = Base64Url.encode(yield* crypto.randomBytes(32));
  const user = {
    createdAt: now,
    email: `learner-${id}@acceptance.invalid`,
    emailVerified: true,
    name: "Acceptance Learner",
    updatedAt: now,
  };
  const created = yield* runLocalConvex(runtime, "Learner account", [
    "run",
    "--component",
    "betterAuth",
    "adapter:create",
    yield* encodeArguments({ input: { data: user, model: "user" } }),
  ]).pipe(Effect.flatMap(Schema.decodeEffect(CreatedDocument)));
  yield* runLocalConvex(runtime, "Learner profile", [
    "run",
    "auth/lifecycle:onCreate",
    yield* encodeArguments({ doc: { ...user, ...created }, model: "user" }),
  ]);
  const session = yield* encodeArguments({
    input: {
      data: {
        createdAt: now,
        expiresAt: now + SESSION_LIFETIME_MS,
        token,
        updatedAt: now,
        userId: created._id,
      },
      model: "session",
    },
  });
  yield* runLocalConvex(
    runtime,
    "Learner session",
    ["run", "--component", "betterAuth", "adapter:create", session],
    [token]
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
