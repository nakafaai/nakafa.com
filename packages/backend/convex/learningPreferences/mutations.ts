import { mutation } from "@repo/backend/convex/functions";
import {
  getActiveTryoutCountryByKey,
  isSchoolCurriculumProgram,
  toCurriculumProgramOption,
  toTryoutCountryOption,
  upsertPreferredCurriculumProgram,
  upsertPreferredTryoutCountry,
} from "@repo/backend/convex/learningPreferences/impl";
import {
  currentLearningPreferenceValidator,
  currentTryoutPreferenceValidator,
} from "@repo/backend/convex/learningPreferences/schema";
import { getLearningProgramByKey } from "@repo/backend/convex/learningPrograms/impl";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { tryoutRouteKeyValidator } from "@repo/backend/convex/tryouts/schema";
import { ConvexError, v } from "convex/values";

/** Saves the authenticated user's preferred school curriculum program. */
export const setPreferredCurriculum = mutation({
  args: {
    locale: v.optional(localeValidator),
    preferredCurriculumProgramKey: v.string(),
  },
  returns: currentLearningPreferenceValidator,
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const program = await getLearningProgramByKey(
      ctx,
      args.preferredCurriculumProgramKey
    );

    if (!program) {
      throw new ConvexError({
        code: "CURRICULUM_PROGRAM_NOT_FOUND",
        message: "Curriculum program not found.",
      });
    }

    if (!isSchoolCurriculumProgram(program)) {
      throw new ConvexError({
        code: "CURRICULUM_PROGRAM_NOT_SUPPORTED",
        message: "Only school curriculum programs can be saved as preference.",
      });
    }

    await upsertPreferredCurriculumProgram({
      ctx,
      now: Date.now(),
      programKey: program.key,
      userId: user.appUser._id,
    });

    return {
      preferredCurriculumProgramKey: program.key,
      program: toCurriculumProgramOption(program, args.locale),
    };
  },
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
    const country = await getActiveTryoutCountryByKey({
      countryKey: args.preferredTryoutCountryKey,
      ctx,
      locale: args.locale,
    });

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
