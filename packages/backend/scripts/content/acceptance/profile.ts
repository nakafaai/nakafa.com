import type { RunConvex } from "@repo/backend/scripts/content/acceptance/account";
import { runLocalConvex } from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import { readLocalRuntime } from "@repo/backend/scripts/content/acceptance/local";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { JsonTextSchema } from "@repo/utilities/json";
import { Clock, Effect, FileSystem, Schema } from "effect";

/**
 * The profile fields that a browser test may write for a synthetic learner: the
 * name and the photo address. Each is optional, so a test writes only the field
 * it names.
 */
const ProfileFile = Schema.fromJsonString(
  Schema.Struct({
    image: Schema.optionalKey(Schema.String),
    name: Schema.optionalKey(Schema.String),
  })
);
/** The profile fields that a test writes. */
type LearnerProfile = typeof ProfileFile.Type;

/**
 * The fields of a Better Auth user that the app's update trigger reads. The
 * trigger copies the name, the photo address and the email address to the app
 * profile, so these are the fields that the trigger needs from each row.
 */
const AuthUser = Schema.Struct({
  _id: Schema.String,
  email: Schema.String,
  emailVerified: Schema.Boolean,
  image: Schema.optionalKey(Schema.NullOr(Schema.String)),
  name: Schema.String,
});
/** What `adapter:findOne` answers: the row, or null when no row matches. */
const FoundAuthUser = Schema.fromJsonString(Schema.NullOr(AuthUser));
/** What `adapter:updateOne` answers: the row after the write. */
const UpdatedAuthUser = Schema.fromJsonString(AuthUser);
/** The arguments of the app's update trigger: the row before and after the write. */
const UpdateTriggerArguments = Schema.fromJsonString(
  Schema.Struct({
    model: Schema.Literal("user"),
    newDoc: AuthUser,
    oldDoc: AuthUser,
  })
);
/** One Convex function's arguments as the CLI takes them, JSON text. */
const encodeArguments = Schema.encodeEffect(JsonTextSchema);

/**
 * Writes the fields that a test names, its name and its photo address, for one
 * synthetic learner the way Better Auth writes them. Then it runs the app's
 * update trigger with the row before and after the write, which copies those
 * fields to the app profile that the sidebar and the comments read. The adapter
 * passes that trigger into its own mutation as a function handle, which a
 * command line call cannot give, so the trigger runs as a second call, as
 * `createLearnerAccount` runs the creation trigger.
 *
 * It fails before it writes when no account has the auth id.
 */
export const updateLearnerProfile = Effect.fn(
  "contentAcceptance.updateLearnerProfile"
)(function* <E, R>(
  run: RunConvex<E, R>,
  authId: string,
  profile: LearnerProfile
) {
  const now = yield* Clock.currentTimeMillis;
  const where = [{ field: "_id", operator: "eq", value: authId }];
  const oldDoc = yield* encodeArguments({ model: "user", where }).pipe(
    Effect.flatMap((args) =>
      run("Learner account read", [
        "run",
        "--component",
        "betterAuth",
        "adapter:findOne",
        args,
      ])
    ),
    Effect.flatMap(Schema.decodeEffect(FoundAuthUser))
  );
  if (oldDoc === null) {
    return yield* acceptanceRuntimeError(
      `No learner account has the auth id ${authId}.`
    );
  }
  const newDoc = yield* encodeArguments({
    input: {
      model: "user",
      update: { ...profile, updatedAt: now },
      where,
    },
  }).pipe(
    Effect.flatMap((args) =>
      run("Learner profile write", [
        "run",
        "--component",
        "betterAuth",
        "adapter:updateOne",
        args,
      ])
    ),
    Effect.flatMap(Schema.decodeEffect(UpdatedAuthUser))
  );
  yield* Schema.encodeEffect(UpdateTriggerArguments)({
    model: "user",
    newDoc,
    oldDoc,
  }).pipe(
    Effect.flatMap((args) =>
      run("Learner profile sync", ["run", "auth/lifecycle:onUpdate", args])
    )
  );
});

/**
 * Writes a profile for the learner of an auth id in the running local runtime.
 * The profile is a JSON file that the browser test wrote, and the runtime must
 * be prepared and running, as for a learner.
 */
export const updateAcceptanceProfile = Effect.fn(
  "contentAcceptance.updateAcceptanceProfile"
)(function* (root: string, authId: string, file: string) {
  const runtime = yield* readLocalRuntime(root);
  if (runtime === undefined) {
    return yield* acceptanceRuntimeError(
      "Run pnpm acceptance:prepare and start acceptance before updating a learner's profile."
    );
  }
  const fs = yield* FileSystem.FileSystem;
  const profile = yield* fs
    .readFileString(file)
    .pipe(Effect.flatMap(Schema.decodeEffect(ProfileFile)));
  yield* updateLearnerProfile(
    (operation, args, sensitiveValues) =>
      runLocalConvex(runtime, operation, args, sensitiveValues),
    authId,
    profile
  );
});

/** The usage of the profile mode: the auth id of the learner, then the JSON file of the profile. */
const USAGE = "profile <auth-user-id> <profile-json-file>";
const ProfileArguments = Schema.Tuple([Schema.String, Schema.String]);

/**
 * The profile mode of the acceptance command line: writes the profile in the file
 * that the command names for the learner of the auth id that it names.
 */
export const profileMode = {
  mode: "profile",
  usage: USAGE,
  run: Effect.fn("contentAcceptance.runProfile")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [authId, file] = yield* decodeModeArguments(
      USAGE,
      ProfileArguments,
      args
    );
    return yield* updateAcceptanceProfile(root, authId, file);
  }),
} satisfies AcceptanceMode;
