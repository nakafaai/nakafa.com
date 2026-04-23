import { requireRichContentSize } from "@repo/backend/convex/assessments/helpers/content";
import { richContentValidator } from "@repo/backend/convex/assessments/schema";
import { loadActiveClass } from "@repo/backend/convex/classes/utils";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { requirePermission } from "@repo/backend/convex/lib/helpers/permissions";
import { ConvexError, v } from "convex/values";

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

    if (args.scope === "class" && !args.classId) {
      throw new ConvexError({
        code: "CLASS_NOT_FOUND",
        message: "Class banks require a class.",
      });
    }

    if (args.scope === "school" && args.classId) {
      throw new ConvexError({
        code: "INVALID_QUESTION_BANK_SCOPE",
        message: "School banks cannot be scoped to a class.",
      });
    }

    const classData = args.classId
      ? await loadActiveClass(ctx, args.classId)
      : null;

    if (classData && classData.schoolId !== args.schoolId) {
      throw new ConvexError({
        code: "CLASS_NOT_FOUND",
        message: "Class not found in this school.",
      });
    }

    await requirePermission(ctx, "assessment:create", {
      userId: user.appUser._id,
      schoolId: args.schoolId,
      classId: classData?._id,
    });

    if (args.description) {
      requireRichContentSize(args.description, "Question bank description");
    }

    return ctx.db.insert("schoolAssessmentQuestionBanks", {
      schoolId: args.schoolId,
      classId: classData?._id,
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

    const classData = args.classId
      ? await loadActiveClass(ctx, args.classId)
      : null;

    if (classData && classData.schoolId !== args.schoolId) {
      throw new ConvexError({
        code: "CLASS_NOT_FOUND",
        message: "Class not found in this school.",
      });
    }

    const bank = await ctx.db.get("schoolAssessmentQuestionBanks", args.bankId);

    if (!bank || bank.schoolId !== args.schoolId) {
      throw new ConvexError({
        code: "QUESTION_BANK_NOT_FOUND",
        message: "Question bank not found in this school.",
      });
    }

    if (bank.classId !== classData?._id) {
      throw new ConvexError({
        code: "QUESTION_BANK_NOT_FOUND",
        message: "Question bank not found for this class scope.",
      });
    }

    await requirePermission(ctx, "assessment:create", {
      userId: user.appUser._id,
      schoolId: bank.schoolId,
      classId: bank.classId,
    });

    requireRichContentSize(args.stem, "Question bank stem");

    if (args.explanation) {
      requireRichContentSize(args.explanation, "Question bank explanation");
    }

    return ctx.db.insert("schoolAssessmentQuestionBankEntries", {
      schoolId: bank.schoolId,
      classId: bank.classId,
      bankId: bank._id,
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
