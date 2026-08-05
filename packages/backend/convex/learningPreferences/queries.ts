import { query } from "@repo/backend/convex/_generated/server";
import {
  readCurrentTryoutCountry,
  toTryoutCountryOption,
} from "@repo/backend/convex/learningPreferences/impl";
import {
  listCurriculumPrograms as listCurriculumProgramOptions,
  readCurrentCurriculumProgram,
} from "@repo/backend/convex/learningPreferences/program";
import {
  currentLearningPreferenceValidator,
  currentTryoutPreferenceValidator,
  curriculumProgramOptionValidator,
} from "@repo/backend/convex/learningPreferences/schema";
import {
  getUnknownErrorMessage,
  runConvexProgram,
} from "@repo/backend/convex/lib/effect";
import { getOptionalAppUserForRead } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { v } from "convex/values";
import { Effect, Schema } from "effect";

const learningPreferenceIoFailedCode = "LEARNING_PREFERENCE_IO_FAILED";

/** Raised when an authenticated preference query cannot read its user. */
class LearningPreferenceIoError extends Schema.TaggedError<LearningPreferenceIoError>()(
  "LearningPreferenceIoError",
  {
    code: Schema.Literal(learningPreferenceIoFailedCode),
    message: Schema.String,
  }
) {}

/** Maps unknown authentication reads into the preference error channel. */
function toLearningPreferenceIoError(error: unknown) {
  return new LearningPreferenceIoError({
    code: learningPreferenceIoFailedCode,
    message: getUnknownErrorMessage(error),
  });
}

/** Lists every curriculum program that can be saved as a user preference. */
export const listCurriculumPrograms = query({
  args: {
    locale: localeValidator,
  },
  returns: v.array(curriculumProgramOptionValidator),
  handler: (ctx, { locale }) =>
    runConvexProgram(listCurriculumProgramOptions(ctx, locale)),
});

/** Returns the current user's preferred curriculum, or null for guests/no preference. */
export const getCurrent = query({
  args: {
    locale: localeValidator,
  },
  returns: currentLearningPreferenceValidator,
  handler: (ctx, { locale }) =>
    runConvexProgram(
      Effect.gen(function* () {
        const user = yield* Effect.tryPromise({
          catch: toLearningPreferenceIoError,
          try: () => getOptionalAppUserForRead(ctx),
        });
        if (!user) {
          return null;
        }
        return yield* readCurrentCurriculumProgram(
          ctx,
          locale,
          user.appUser._id
        );
      })
    ),
});

/** Returns the current user's preferred try-out country, or null for guests/no preference. */
export const getCurrentTryout = query({
  args: {
    locale: localeValidator,
  },
  returns: currentTryoutPreferenceValidator,
  handler: async (ctx, args) => {
    const user = await getOptionalAppUserForRead(ctx);

    if (!user) {
      return null;
    }

    const preference = await runConvexProgram(
      readCurrentTryoutCountry(ctx, {
        locale: args.locale,
        userId: user.appUser._id,
      })
    );

    if (!preference) {
      return null;
    }

    return {
      country: toTryoutCountryOption(preference.country),
      preferredTryoutCountryKey: preference.preferredTryoutCountryKey,
    };
  },
});
