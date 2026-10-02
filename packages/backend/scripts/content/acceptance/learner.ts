import { createHmac, randomBytes } from "node:crypto";
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
import { Clock, Effect, FileSystem, Schema } from "effect";

/** Better Auth's session cookie under its default name on plain HTTP. */
const SESSION_COOKIE = "better-auth.session_token";
/** Outlives any browser suite run; the whole runtime is discarded after. */
const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000;
const CreatedDocument = Schema.fromJsonString(
  Schema.Struct({ _creationTime: Schema.Finite, _id: Schema.String })
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
  const now = yield* Clock.currentTimeMillis;
  const { id, token } = yield* Effect.sync(() => ({
    id: randomBytes(8).toString("hex"),
    token: randomBytes(32).toString("base64url"),
  }));
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
    JSON.stringify({ input: { data: user, model: "user" } }),
  ]).pipe(Effect.flatMap(Schema.decodeEffect(CreatedDocument)));
  yield* runLocalConvex(runtime, "Learner profile", [
    "run",
    "auth/lifecycle:onCreate",
    JSON.stringify({ doc: { ...user, ...created }, model: "user" }),
  ]);
  yield* runLocalConvex(
    runtime,
    "Learner session",
    [
      "run",
      "--component",
      "betterAuth",
      "adapter:create",
      JSON.stringify({
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
      }),
    ],
    [token]
  );
  const signature = createHmac("sha256", LOCAL_AUTH_SECRET)
    .update(token)
    .digest("base64");
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(
    output,
    JSON.stringify({
      name: SESSION_COOKIE,
      value: encodeURIComponent(`${token}.${signature}`),
    }),
    { flag: "wx", mode: 0o600 }
  );
});
