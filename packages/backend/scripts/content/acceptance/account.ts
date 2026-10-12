import { JsonTextSchema } from "@repo/utilities/json";
import { Clock, Crypto, Duration, Effect, Schema } from "effect";
import { Base64Url, Hex } from "effect/encoding";

/** A document the Convex CLI printed after it created a Better Auth row. */
const CreatedDocument = Schema.fromJsonString(
  Schema.Struct({ _creationTime: Schema.Finite, _id: Schema.String })
);
/** One Convex function's arguments as the CLI takes them, JSON text. */
const encodeArguments = Schema.encodeEffect(JsonTextSchema);

/**
 * Runs one Convex CLI command and returns what it printed. The runner owns
 * which deployment the command reaches, and keeps `sensitiveValues` out of
 * the errors it reports.
 */
export type RunConvex<E, R> = (
  operation: string,
  args: readonly string[],
  sensitiveValues?: readonly string[]
) => Effect.Effect<string, E, R>;

/**
 * Creates the rows of one synthetic learner through `run`: the Better Auth
 * account, the app profile that the app's own creation trigger writes, and a
 * session that expires after `lifetime`. Each call creates a new learner, so
 * every caller starts from a learner without history. Returns the secret
 * session token and the ids Better Auth gave the user and the session.
 */
export const createLearnerAccount = Effect.fn(
  "contentAcceptance.createLearnerAccount"
)(function* <E, R>(run: RunConvex<E, R>, lifetime: Duration.Duration) {
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
  const created = yield* run("Learner account", [
    "run",
    "--component",
    "betterAuth",
    "adapter:create",
    yield* encodeArguments({ input: { data: user, model: "user" } }),
  ]).pipe(Effect.flatMap(Schema.decodeEffect(CreatedDocument)));
  yield* run("Learner profile", [
    "run",
    "auth/lifecycle:onCreate",
    yield* encodeArguments({ doc: { ...user, ...created }, model: "user" }),
  ]);
  const session = yield* encodeArguments({
    input: {
      data: {
        createdAt: now,
        expiresAt: now + Duration.toMillis(lifetime),
        token,
        updatedAt: now,
        userId: created._id,
      },
      model: "session",
    },
  });
  const opened = yield* run(
    "Learner session",
    ["run", "--component", "betterAuth", "adapter:create", session],
    [token]
  ).pipe(Effect.flatMap(Schema.decodeEffect(CreatedDocument)));
  return { sessionId: opened._id, token, userId: created._id };
});
