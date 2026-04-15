import { requireRichContentSize } from "@repo/backend/convex/assessments/helpers/content";
import { richContentValidator } from "@repo/backend/convex/assessments/schema";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { requirePermission } from "@repo/backend/convex/lib/helpers/permissions";
import { v } from "convex/values";

/** Create one reusable question bank in class or school scope. */
export const createQuestionBank = mutation({
  args: {
    schoolId: v.id("schools"),
    classId: v.optional(v.id("schoolClasses")),
    scope: v.union(v.literal("class"), v.literal("school")),
    title: v.string(),
    description: v.optional(richContentValidator),
  },
  returns: v.id("schoolAssessmentQuestionBanks"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    await requirePermission(ctx, "assessment:create", {
      userId: user.appUser._id,
      schoolId: args.schoolId,
      classId: args.classId,
    });

    if (args.description) {
      requireRichContentSize(args.description, "Question bank description");
    }

    return ctx.db.insert("schoolAssessmentQuestionBanks", {
      schoolId: args.schoolId,
      classId: args.classId,
      scope: args.scope,
      title: args.title,
      description: args.description,
      createdBy: user.appUser._id,
      updatedBy: user.appUser._id,
      updatedAt: Date.now(),
    });
  },
});

/** Add one reusable question bank entry without attaching it to an authored assessment. */
export const createQuestionBankEntry = mutation({
  args: {
    schoolId: v.id("schools"),
    classId: v.optional(v.id("schoolClasses")),
    bankId: v.id("schoolAssessmentQuestionBanks"),
    questionType: v.union(
      v.literal("mcq-single"),
      v.literal("mcq-multi"),
      v.literal("essay")
    ),
    stem: richContentValidator,
    explanation: v.optional(richContentValidator),
    points: v.number(),
    shuffleChoices: v.boolean(),
    maxSelectionCount: v.optional(v.number()),
  },
  returns: v.id("schoolAssessmentQuestionBankEntries"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    await requirePermission(ctx, "assessment:create", {
      userId: user.appUser._id,
      schoolId: args.schoolId,
      classId: args.classId,
    });

    requireRichContentSize(args.stem, "Question bank stem");

    if (args.explanation) {
      requireRichContentSize(args.explanation, "Question bank explanation");
    }

    return ctx.db.insert("schoolAssessmentQuestionBankEntries", {
      schoolId: args.schoolId,
      classId: args.classId,
      bankId: args.bankId,
      questionType: args.questionType,
      stem: args.stem,
      explanation: args.explanation,
      points: args.points,
      shuffleChoices: args.shuffleChoices,
      maxSelectionCount: args.maxSelectionCount,
      source: "manual",
      createdBy: user.appUser._id,
      updatedBy: user.appUser._id,
      updatedAt: Date.now(),
    });
  },
});
