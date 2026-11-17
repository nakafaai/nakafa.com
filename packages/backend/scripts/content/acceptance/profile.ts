import {
  LocalConvex,
  localConvexLayer,
} from "@repo/backend/scripts/content/acceptance/convex";
import {
  type AcceptanceMode,
  decodeModeArguments,
} from "@repo/backend/scripts/content/acceptance/mode";
import { Effect, FileSystem, Schema } from "effect";

/**
 * The profile fields that a browser test may write for a synthetic learner: the
 * name and the photo address. Each is optional, so a test writes only the field
 * it names.
 */
const LearnerProfile = Schema.Struct({
  image: Schema.optionalKey(Schema.String),
  name: Schema.optionalKey(Schema.String),
});

/** Writes a profile for the learner of an account id in the running local runtime. */
export const seedProfile = Effect.fn("contentAcceptance.seedProfile")(
  function* (userId: string, profile: typeof LearnerProfile.Type) {
    const { run } = yield* LocalConvex;
    yield* run("Learner profile", {
      args: { ...profile, userId },
      path: "acceptance/accounts:profile",
    });
  }
);

/** The usage of the profile mode: the account id of the learner, then the JSON file of the profile. */
const USAGE = "profile <user-id> <profile-json-file>";
const ProfileArguments = Schema.Tuple([Schema.String, Schema.String]);

/**
 * The profile mode of the acceptance command line: writes the profile in the file
 * that the command names for the learner of the account id that it names.
 */
export const profileMode = {
  mode: "profile",
  usage: USAGE,
  run: Effect.fn("contentAcceptance.runProfile")(function* (
    root: string,
    args: readonly string[]
  ) {
    const [userId, file] = yield* decodeModeArguments(
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
    yield* seedProfile(userId, profile).pipe(
      Effect.provide(localConvexLayer(root))
    );
  }),
} satisfies AcceptanceMode;
