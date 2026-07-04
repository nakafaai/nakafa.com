import { query } from "@repo/backend/convex/_generated/server";
import {
  getCurrentCurriculumProgram,
  listSchoolCurriculumPrograms,
  toCurriculumProgramOption,
} from "@repo/backend/convex/learningPreferences/impl";
import {
  currentLearningPreferenceValidator,
  curriculumProgramOptionValidator,
} from "@repo/backend/convex/learningPreferences/schema";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { v } from "convex/values";

/** Lists every curriculum program that can be saved as a user preference. */
export const listCurriculumPrograms = query({
  args: {
    locale: v.optional(localeValidator),
  },
  returns: v.array(curriculumProgramOptionValidator),
  handler: async (ctx, args) => {
    const programs = await listSchoolCurriculumPrograms(ctx);

    return programs.map((program) =>
      toCurriculumProgramOption(program, args.locale)
    );
  },
});

/** Returns the current user's preferred curriculum, or null for guests/no preference. */
export const getCurrent = query({
  args: {
    locale: v.optional(localeValidator),
  },
  returns: currentLearningPreferenceValidator,
  handler: async (ctx, args) => {
    const user = await getOptionalAppUser(ctx);

    if (!user) {
      return null;
    }

    const preference = await getCurrentCurriculumProgram(ctx, user.appUser._id);

    if (!preference) {
      return null;
    }

    return {
      preferredCurriculumProgramKey: preference.preferredCurriculumProgramKey,
      program: toCurriculumProgramOption(preference.program, args.locale),
    };
  },
});
