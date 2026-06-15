import { query } from "@repo/backend/convex/_generated/server";
import { toLearningProgramSummary } from "@repo/backend/convex/learningPrograms/impl";
import {
  activeLearningProfileValidator,
  learningProgramSummaryValidator,
} from "@repo/backend/convex/learningPrograms/schema";
import { getOptionalAppUser } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { v } from "convex/values";

const PROGRAM_LIMIT = 50;
const PLAN_ITEM_LIMIT = 20;

/** Lists selectable learning programs from the Convex catalog. */
export const listSelectablePrograms = query({
  args: {
    locale: v.optional(localeValidator),
  },
  returns: v.array(learningProgramSummaryValidator),
  handler: async (ctx, args) => {
    const locale = args.locale;

    if (locale) {
      const programs = await ctx.db
        .query("learningPrograms")
        .withIndex("by_locale_and_displayOrder", (q) => q.eq("locale", locale))
        .take(PROGRAM_LIMIT);

      return programs
        .filter((program) => program.defaultCoverageStatus !== "hidden")
        .filter((program) => program.defaultCoverageStatus !== "archived")
        .map(toLearningProgramSummary);
    }

    const programs = await ctx.db
      .query("learningPrograms")
      .withIndex("by_displayOrder")
      .take(PROGRAM_LIMIT);

    return programs
      .filter((program) => program.defaultCoverageStatus !== "hidden")
      .filter((program) => program.defaultCoverageStatus !== "archived")
      .map(toLearningProgramSummary);
  },
});

/** Returns the current user's active profile and first learning plan items. */
export const getActiveProfile = query({
  args: {},
  returns: activeLearningProfileValidator,
  handler: async (ctx) => {
    const user = await getOptionalAppUser(ctx);

    if (!user) {
      return null;
    }

    const profile = await ctx.db
      .query("learningProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", user.appUser._id))
      .unique();

    if (!profile) {
      return null;
    }

    const program = await ctx.db.get(profile.programId);

    if (!program) {
      return null;
    }

    const activePlanId = profile.activePlanId;
    const planItems = activePlanId
      ? await ctx.db
          .query("learningPlanItems")
          .withIndex("by_planId_and_position", (q) =>
            q.eq("planId", activePlanId)
          )
          .take(PLAN_ITEM_LIMIT)
      : [];

    return {
      interests: profile.interests,
      planItems: planItems.map((item) => ({
        content_id: item.content_id,
        lensId: item.lensId,
        position: item.position,
        reason: item.reason,
        route: item.route,
        status: item.status,
        title: item.title,
      })),
      program: toLearningProgramSummary(program),
      stage: profile.stage,
    };
  },
});
