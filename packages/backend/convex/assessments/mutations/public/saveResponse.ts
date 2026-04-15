import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { ConvexError, v } from "convex/values";

/** Save or replace one response row for the current student's in-progress attempt. */
export const saveResponse = mutation({
  args: {
    attemptId: v.id("schoolAssessmentAttempts"),
    questionId: v.id("schoolAssessmentVersionQuestions"),
    questionType: v.union(
      v.literal("mcq-single"),
      v.literal("mcq-multi"),
      v.literal("essay")
    ),
    selectedChoiceIds: v.optional(
      v.array(v.id("schoolAssessmentVersionChoices"))
    ),
    essayContent: v.optional(
      v.object({
        format: v.literal("plate-v1"),
        json: v.string(),
        text: v.string(),
      })
    ),
    essayAttachmentStorageIds: v.optional(v.array(v.id("_storage"))),
    isFinal: v.boolean(),
  },
  returns: v.id("schoolAssessmentResponses"),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const attempt = await ctx.db.get(
      "schoolAssessmentAttempts",
      args.attemptId
    );

    if (!attempt || attempt.studentId !== user.appUser._id) {
      throw new ConvexError({
        code: "ATTEMPT_NOT_FOUND",
        message: "Attempt not found for the current user.",
      });
    }

    if (attempt.status !== "in-progress") {
      throw new ConvexError({
        code: "ATTEMPT_NOT_EDITABLE",
        message: "Only in-progress attempts can accept answers.",
      });
    }

    const existing = await ctx.db
      .query("schoolAssessmentResponses")
      .withIndex("by_attemptId_and_questionId", (q) =>
        q.eq("attemptId", args.attemptId).eq("questionId", args.questionId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch("schoolAssessmentResponses", existing._id, {
        questionType: args.questionType,
        selectedChoiceIds: args.selectedChoiceIds,
        essayContent: args.essayContent,
        essayAttachmentStorageIds: args.essayAttachmentStorageIds,
        isFinal: args.isFinal,
        submittedAt: Date.now(),
      });

      return existing._id;
    }

    return ctx.db.insert("schoolAssessmentResponses", {
      schoolId: attempt.schoolId,
      classId: attempt.classId,
      assignmentId: attempt.assignmentId,
      attemptId: attempt._id,
      questionId: args.questionId,
      questionType: args.questionType,
      selectedChoiceIds: args.selectedChoiceIds,
      essayContent: args.essayContent,
      essayAttachmentStorageIds: args.essayAttachmentStorageIds,
      isFinal: args.isFinal,
      submittedAt: Date.now(),
    });
  },
});
