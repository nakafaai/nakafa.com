import { mutation } from "@repo/backend/convex/functions";
import {
  readActiveTryoutCountry,
  toTryoutCountryOption,
  upsertPreferredTryoutCountry,
} from "@repo/backend/convex/learningPreferences/impl";
import { saveCurriculumProgram } from "@repo/backend/convex/learningPreferences/program";
import {
  currentLearningPreferenceValidator,
  currentTryoutPreferenceValidator,
} from "@repo/backend/convex/learningPreferences/schema";
import {
  getUnknownErrorMessage,
  runConvexProgram,
} from "@repo/backend/convex/lib/effect";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/route";
import { ConvexError, v } from "convex/values";
import { Effect, Schema } from "effect";

const curriculumPreferenceAuthFailedCode = "CURRICULUM_PREFERENCE_AUTH_FAILED";

/** Raised when curriculum preference authentication fails unexpectedly. */
class CurriculumPreferenceAuthError extends Schema.TaggedError<CurriculumPreferenceAuthError>()(
  "CurriculumPreferenceAuthError",
  {
    code: Schema.Literal(curriculumPreferenceAuthFailedCode),
    message: Schema.String,
  }
) {}

/** Saves the authenticated user's preferred school curriculum program. */
export const setPreferredCurriculum = mutation({
  args: {
    locale: localeValidator,
    preferredCurriculumProgramKey: v.string(),
  },
  returns: currentLearningPreferenceValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        const user = yield* Effect.tryPromise({
          catch: (error) =>
            new CurriculumPreferenceAuthError({
              code: curriculumPreferenceAuthFailedCode,
              message: getUnknownErrorMessage(error),
            }),
          try: () => requireAuth(ctx),
        });
        return yield* saveCurriculumProgram(
          ctx,
          args.locale,
          args.preferredCurriculumProgramKey,
          user.appUser._id
        );
      })
    ),
});

/** Saves the authenticated user's preferred try-out country. */
export const setPreferredTryoutCountry = mutation({
  args: {
    locale: localeValidator,
    preferredTryoutCountryKey: tryoutRouteKeyValidator,
  },
  returns: currentTryoutPreferenceValidator,
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const country = await runConvexProgram(
      readActiveTryoutCountry(ctx, {
        countryKey: args.preferredTryoutCountryKey,
        locale: args.locale,
      })
    );

    if (!country) {
      throw new ConvexError({
        code: "TRYOUT_COUNTRY_NOT_FOUND",
        message: "Try-out country not found.",
      });
    }

    await upsertPreferredTryoutCountry({
      countryKey: country.countryKey,
      ctx,
      now: Date.now(),
      userId: user.appUser._id,
    });

    return {
      country: toTryoutCountryOption(country),
      preferredTryoutCountryKey: country.countryKey,
    };
  },
});
