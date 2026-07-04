import { mutation } from "@repo/backend/convex/functions";
import {
  isSchoolCurriculumProgram,
  toCurriculumProgramOption,
  upsertPreferredCurriculumProgram,
} from "@repo/backend/convex/learningPreferences/impl";
import { currentLearningPreferenceValidator } from "@repo/backend/convex/learningPreferences/schema";
import { getLearningProgramByKey } from "@repo/backend/convex/learningPrograms/impl";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
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
