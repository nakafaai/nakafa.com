import {
  LocalConvex,
  localConvexLayer,
  type RunConvex,
} from "@repo/backend/scripts/content/acceptance/convex";
import { acceptanceRuntimeError } from "@repo/backend/scripts/content/acceptance/error";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { Clock, Effect, FileSystem, Schema } from "effect";

/**
 * The profile fields that a browser test may write for a synthetic learner: the
 * name and the photo address. Each is optional, so a test writes only the field
 * it names.
 */
const LearnerProfile = Schema.Struct({
  image: Schema.optionalKey(Schema.String),
  name: Schema.optionalKey(Schema.String),
});

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
const FoundAuthUser = Schema.NullOr(AuthUser);
/** The Better Auth component, which owns every account row. */
const BETTER_AUTH = "betterAuth";

/**
 * Writes the fields that a test names, its name and its photo address, for one
 * synthetic learner the way Better Auth writes them. Then it runs the app's
 * update trigger with the row before and after the write, which copies those
 * fields to the app profile that the sidebar and the comments read. The adapter
 * passes that trigger into its own mutation as a function handle, which an
 * admin call cannot give, so the trigger runs as a second call, as
 * `createLearnerAccount` runs the creation trigger.
 *
 * It fails before it writes when no account has the auth id.
 */
export const updateLearnerProfile = Effect.fn(
  "contentAcceptance.updateLearnerProfile"
)(function* <E, R>(
  run: RunConvex<E, R>,
  authId: string,
  profile: typeof LearnerProfile.Type
) {
  const now = yield* Clock.currentTimeMillis;
  const where = [{ field: "_id", operator: "eq", value: authId }];
  const oldDoc = yield* run("Learner account read", {
    args: { model: "user", where },
    component: BETTER_AUTH,
    path: "adapter:findOne",
  }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(FoundAuthUser)));
  if (oldDoc === null) {
    return yield* acceptanceRuntimeError(
      `No learner account has the auth id ${authId}.`
    );
  }
  const newDoc = yield* run("Learner profile write", {
    args: {
      input: { model: "user", update: { ...profile, updatedAt: now }, where },
    },
    component: BETTER_AUTH,
    path: "adapter:updateOne",
  }).pipe(Effect.flatMap(Schema.decodeUnknownEffect(AuthUser)));
  yield* run("Learner profile sync", {
    args: { model: "user", newDoc, oldDoc },
    path: "auth/lifecycle:onUpdate",
  });
});

/** Writes a profile for the learner of an auth id in the running local runtime. */
export const seedProfile = Effect.fn("contentAcceptance.seedProfile")(
  function* (authId: string, profile: typeof LearnerProfile.Type) {
    const { run } = yield* LocalConvex;
    yield* updateLearnerProfile(run, authId, profile);
  }
);

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
    const profile = yield* (yield* FileSystem.FileSystem)
      .readFileString(file)
      .pipe(
        Effect.flatMap(
          Schema.decodeEffect(Schema.fromJsonString(LearnerProfile))
        )
      );
    yield* seedProfile(authId, profile).pipe(
      Effect.provide(localConvexLayer(root))
    );
  }),
} satisfies AcceptanceMode;
