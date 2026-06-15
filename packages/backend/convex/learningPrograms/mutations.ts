import { mutation } from "@repo/backend/convex/functions";
import {
  createInitialLearningPlanItems,
  getLearningProgramByKey,
  hasLearningProgramCoverageForLocale,
  isLearningProgramSelectable,
  supersedeActivePlans,
  toLearningProgramSummary,
} from "@repo/backend/convex/learningPrograms/impl";
import {
  activeLearningProfileValidator,
  learningInterestValidator,
  learningStageValidator,
} from "@repo/backend/convex/learningPrograms/schema";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import {
  LEARNING_INTEREST_PROGRAM_KIND_MATCHES,
  type LearningInterest,
  type LearningProgramKind,
} from "@repo/contents/_types/program/schema";
import { ConvexError, v } from "convex/values";

/** Selects the user's active learning interests and creates a first graph-backed plan. */
export const selectLearningProgram = mutation({
  args: {
    interests: v.array(learningInterestValidator),
    locale: localeValidator,
    primaryProgramKey: v.string(),
    stage: v.optional(learningStageValidator),
  },
  returns: activeLearningProfileValidator,
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const interests = getUniqueInterests(args.interests);
    const program = await getLearningProgramByKey(ctx, args.primaryProgramKey);

    if (interests.length === 0) {
      throw new ConvexError({
        code: "LEARNING_INTERESTS_REQUIRED",
        message: "Select at least one learning interest.",
      });
    }

    if (!program) {
      throw new ConvexError({
        code: "LEARNING_PROGRAM_NOT_FOUND",
        message: "Learning program not found.",
      });
    }

    if (!isLearningProgramSelectable(program)) {
      throw new ConvexError({
        code: "LEARNING_PROGRAM_NOT_SELECTABLE",
        message: "Learning program is not selectable.",
      });
    }

    if (!programMatchesInterests(program.kind, interests)) {
      throw new ConvexError({
        code: "LEARNING_PROGRAM_INTEREST_MISMATCH",
        message: "Selected program does not match the selected interests.",
      });
    }

    if (
      !(await hasLearningProgramCoverageForLocale(ctx, {
        locale: args.locale,
        programId: program._id,
      }))
    ) {
      throw new ConvexError({
        code: "LEARNING_PROGRAM_CONTENT_LOCALE_UNAVAILABLE",
        message:
          "Learning program has no ready content coverage for this language.",
      });
    }

    const now = Date.now();
    const existingProfile = await ctx.db
      .query("learningProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", user.appUser._id))
      .unique();
    const profileId =
      existingProfile?._id ??
      (await ctx.db.insert("learningProfiles", {
        interests,
        programId: program._id,
        stage: args.stage,
        updatedAt: now,
        userId: user.appUser._id,
      }));

    await supersedeActivePlans(ctx, user.appUser._id);

    if (existingProfile) {
      await ctx.db.replace(existingProfile._id, {
        interests,
        programId: program._id,
        stage: args.stage,
        updatedAt: now,
        userId: user.appUser._id,
      });
    }

    const planId = await ctx.db.insert("learningPlans", {
      createdAt: now,
      profileId,
      programId: program._id,
      status: "active",
      updatedAt: now,
      userId: user.appUser._id,
      version: 1,
    });

    await createInitialLearningPlanItems(ctx, {
      locale: args.locale,
      planId,
      programId: program._id,
      userId: user.appUser._id,
    });
    await ctx.db.patch(profileId, { activePlanId: planId, updatedAt: now });

    const planItems = await ctx.db
      .query("learningPlanItems")
      .withIndex("by_planId_and_position", (q) => q.eq("planId", planId))
      .take(20);

    return {
      interests,
      planItems: planItems.map((item) => ({
        content_id: item.content_id,
        lensId: item.lensId,
        position: item.position,
        reason: item.reason,
        route: item.route,
        status: item.status,
        title: item.title,
      })),
      program: toLearningProgramSummary(program, args.locale),
      stage: args.stage,
    };
  },
});

/** Removes duplicate interests before they are stored on the learning profile. */
function getUniqueInterests(interests: readonly LearningInterest[]) {
  return Array.from(new Set(interests));
}

/** Checks that the selected primary program belongs to at least one interest. */
function programMatchesInterests(
  programKind: LearningProgramKind,
  interests: readonly LearningInterest[]
) {
  return interests.some((interest) =>
    LEARNING_INTEREST_PROGRAM_KIND_MATCHES[interest].some(
      (kind) => kind === programKind
    )
  );
}
