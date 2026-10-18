import { JsonTextSchema } from "@repo/utilities/json";
import { Clock, Crypto, Duration, Effect, Schema, String as Str } from "effect";
import { Base64Url, Hex } from "effect/encoding";

/** A document the Convex CLI printed after it created a Better Auth row. */
const CreatedDocument = Schema.fromJsonString(
  Schema.Struct({ _creationTime: Schema.Finite, _id: Schema.String })
);
/** One Convex function's arguments as the CLI takes them, JSON text. */
const encodeArguments = Schema.encodeEffect(JsonTextSchema);
/**
 * What `adapter:findOne` answers for a user: the row, or null when no row matches.
 * The Convex CLI prints nothing for a null result, so empty output reads as null.
 */
const FoundUser = Schema.fromJsonString(
  Schema.NullOr(Schema.Struct({ _id: Schema.String }))
);

/**
 * Writes one session row for a Better Auth user, valid for `lifetime` from `now`.
 * The token is the session's secret, so the runner keeps it out of its errors.
 */
const writeSession = Effect.fn("contentAcceptance.writeSession")(function* <
  E,
  R,
>(
  run: RunConvex<E, R>,
  session: {
    readonly lifetime: Duration.Duration;
    readonly now: number;
    readonly token: string;
    readonly userId: string;
  }
) {
  return yield* encodeArguments({
    input: {
      data: {
        createdAt: session.now,
        expiresAt: session.now + Duration.toMillis(session.lifetime),
        token: session.token,
        updatedAt: session.now,
        userId: session.userId,
      },
      model: "session",
    },
  }).pipe(
    Effect.flatMap((args) =>
      run(
        "Learner session",
        ["run", "--component", "betterAuth", "adapter:create", args],
        [session.token]
      )
    ),
    Effect.flatMap(Schema.decodeEffect(CreatedDocument))
  );
});

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
 * Deletes one Better Auth row that this module created, by its id. It only
 * undoes a failed creation, so it never fails: a removal that does not work is
 * logged with the row it left, and the failure that caused it stays the one the
 * caller sees. A row that is already gone is not an error.
 */
const removeRow = Effect.fn("contentAcceptance.removeLearnerRow")(function* <
  E,
  R,
>(
  run: RunConvex<E, R>,
  operation: string,
  model: "session" | "user",
  id: string
) {
  yield* encodeArguments({
    input: { model, where: [{ field: "_id", operator: "eq", value: id }] },
  }).pipe(
    Effect.flatMap((args) =>
      run(operation, [
        "run",
        "--component",
        "betterAuth",
        "adapter:deleteOne",
        args,
      ])
    ),
    Effect.ignoreCause({ log: "Warn", message: `${operation} failed` }),
    Effect.annotateLogs({ id, model })
  );
});

/**
 * Creates the rows of one synthetic learner through `run`: the Better Auth
 * account, a session that expires after `lifetime`, and the app profile that
 * the app's own creation trigger writes. Each call creates a new learner, so
 * every caller starts from a learner without history. An `address` replaces the
 * synthetic email, so the account holds that address, such as the Owner address
 * of a school. Returns the secret session token and the ids Better Auth gave the
 * user and the session.
 *
 * The profile goes last because it is the one row that only the app's own
 * deletion can remove again. A step that fails therefore leaves Better Auth
 * rows and nothing else, and this function removes them, newest first, before
 * it fails. A command that the CLI gave up on may still have run, and a row
 * that was written by it is not known here, so it stays.
 */
export const createLearnerAccount = Effect.fn(
  "contentAcceptance.createLearnerAccount"
)(function* <E, R>(
  run: RunConvex<E, R>,
  lifetime: Duration.Duration,
  address?: string
) {
  const now = yield* Clock.currentTimeMillis;
  const crypto = yield* Crypto.Crypto;
  const id = Hex.encode(yield* crypto.randomBytes(8));
  const token = Base64Url.encode(yield* crypto.randomBytes(32));
  const user = {
    createdAt: now,
    email: address ?? `learner-${id}@acceptance.invalid`,
    emailVerified: true,
    name: "Acceptance Learner",
    updatedAt: now,
  };
  const created = yield* encodeArguments({
    input: { data: user, model: "user" },
  }).pipe(
    Effect.flatMap((args) =>
      run("Learner account", [
        "run",
        "--component",
        "betterAuth",
        "adapter:create",
        args,
      ])
    ),
    Effect.flatMap(Schema.decodeEffect(CreatedDocument))
  );
  const removeAccount = removeRow(
    run,
    "Learner account removal",
    "user",
    created._id
  );
  const opened = yield* writeSession(run, {
    lifetime,
    now,
    token,
    userId: created._id,
  }).pipe(Effect.onError(() => removeAccount));
  const removeSession = removeRow(
    run,
    "Learner session removal",
    "session",
    opened._id
  );
  yield* encodeArguments({
    doc: { ...user, ...created },
    model: "user",
  }).pipe(
    Effect.flatMap((args) =>
      run("Learner profile", ["run", "auth/lifecycle:onCreate", args])
    ),
    Effect.onError(() => Effect.andThen(removeSession, removeAccount))
  );
  return { sessionId: opened._id, token, userId: created._id };
});

/**
 * Signs in the account that holds `address`. When no account holds it, the account
 * is created the way `createLearnerAccount` creates one. When one does, it keeps its
 * profile and gets a new session, so a learner who is invited to a second school
 * signs in as the same account, and both invitations land in one inbox. Returns the
 * secret session token and the ids of the user and the session.
 */
export const openLearnerAccount = Effect.fn(
  "contentAcceptance.openLearnerAccount"
)(function* <E, R>(
  run: RunConvex<E, R>,
  lifetime: Duration.Duration,
  address: string
) {
  const existing = yield* encodeArguments({
    model: "user",
    where: [{ field: "email", operator: "eq", value: address }],
  }).pipe(
    Effect.flatMap((args) =>
      run("Learner account lookup", [
        "run",
        "--component",
        "betterAuth",
        "adapter:findOne",
        args,
      ])
    ),
    Effect.map((printed) =>
      Str.isEmpty(Str.trim(printed)) ? "null" : printed
    ),
    Effect.flatMap(Schema.decodeEffect(FoundUser))
  );
  if (existing === null) {
    return yield* createLearnerAccount(run, lifetime, address);
  }
  const now = yield* Clock.currentTimeMillis;
  const crypto = yield* Crypto.Crypto;
  const token = Base64Url.encode(yield* crypto.randomBytes(32));
  const opened = yield* writeSession(run, {
    lifetime,
    now,
    token,
    userId: existing._id,
  });
  return { sessionId: opened._id, token, userId: existing._id };
});
