import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { ConvexError, v } from "convex/values";

/** Submit one in-progress attempt and auto-grade objective questions. */
export const submitAttempt = mutation({
  args: {
    attemptId: v.id("schoolAssessmentAttempts"),
  },
  returns: v.null(),
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
      return null;
    }

    const assignment = await ctx.db.get(
      "schoolAssessmentAssignments",
      attempt.assignmentId
    );

    if (!assignment) {
      throw new Error(`Expected assignment for attemptId: ${args.attemptId}`);
    }

    const responses = await ctx.db
      .query("schoolAssessmentResponses")
      .withIndex("by_attemptId_and_questionId", (q) =>
        q.eq("attemptId", args.attemptId)
      )
      .collect();

    let autoScore = 0;

    for (const response of responses) {
      if (
        response.questionType === "essay" ||
        !response.selectedChoiceIds ||
        response.selectedChoiceIds.length === 0
      ) {
        continue;
      }

      const [question, choices] = await Promise.all([
        ctx.db.get("schoolAssessmentVersionQuestions", response.questionId),
        ctx.db
          .query("schoolAssessmentVersionChoices")
          .withIndex("by_questionId_and_order", (q) =>
            q.eq("questionId", response.questionId)
          )
          .collect(),
      ]);

      if (!question) {
        continue;
      }

      const correctChoiceIds = choices
        .filter((choice) => choice.isCorrect)
        .map((choice) => choice._id)
        .sort();
      const selectedChoiceIds = [...response.selectedChoiceIds].sort();

      const isCorrect =
        correctChoiceIds.length === selectedChoiceIds.length &&
        correctChoiceIds.every(
          (choiceId, index) => choiceId === selectedChoiceIds[index]
        );

      if (isCorrect) {
        autoScore += question.points;
      }

      await ctx.db.patch("schoolAssessmentResponses", response._id, {
        autoScore: isCorrect ? question.points : 0,
      });
    }

    let hasEssayQuestions = false;

    if (assignment.gradingMode === "hybrid") {
      const versionQuestions = await ctx.db
        .query("schoolAssessmentVersionQuestions")
        .withIndex("by_versionId_and_sectionId_and_order", (q) =>
          q.eq("versionId", attempt.versionId)
        )
        .collect();

      hasEssayQuestions = versionQuestions.some(
        (question) => question.questionType === "essay"
      );
    }

    const gradingStatus =
      assignment.gradingMode === "manual" ||
      (assignment.gradingMode === "hybrid" && hasEssayQuestions)
        ? "awaiting-manual-review"
        : "auto-graded";

    const submittedAt = Date.now();

    await ctx.db.patch("schoolAssessmentAttempts", args.attemptId, {
      status: "submitted",
      gradingStatus,
      score: autoScore,
      submittedAt,
      completedAt: submittedAt,
    });

    return null;
  },
});
