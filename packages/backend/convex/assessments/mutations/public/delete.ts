import {
  requireAssessment,
  requireAssessmentPermission,
} from "@repo/backend/convex/assessments/helpers/access";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { ConvexError, v } from "convex/values";

/** Delete one authored assessment that has not been assigned yet. */
export const deleteAssessment = mutation({
  args: {
    schoolId: v.id("schools"),
    assessmentId: v.id("schoolAssessments"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    await requireAssessmentPermission(
      ctx,
      user.appUser._id,
      args.schoolId,
      "assessment:delete"
    );

    await requireAssessment(ctx, args.schoolId, args.assessmentId);

    const assignments = await ctx.db
      .query("schoolAssessmentAssignments")
      .withIndex("by_assessmentId_and_status", (q) =>
        q.eq("assessmentId", args.assessmentId)
      )
      .collect();

    if (assignments.length > 0) {
      throw new ConvexError({
        code: "ASSESSMENT_DELETE_BLOCKED",
        message: "Assigned assessments must be archived instead of deleted.",
      });
    }

    const versions = await ctx.db
      .query("schoolAssessmentVersions")
      .withIndex("by_assessmentId_and_versionNumber", (q) =>
        q.eq("assessmentId", args.assessmentId)
      )
      .collect();
    const sections = await ctx.db
      .query("schoolAssessmentSections")
      .withIndex("by_assessmentId_and_order", (q) =>
        q.eq("assessmentId", args.assessmentId)
      )
      .collect();
    const questions = await ctx.db
      .query("schoolAssessmentQuestions")
      .withIndex("by_assessmentId_and_sectionId_and_order", (q) =>
        q.eq("assessmentId", args.assessmentId)
      )
      .collect();

    const versionIds = new Set(versions.map((version) => version._id));
    const versionSections = (
      await ctx.db.query("schoolAssessmentVersionSections").collect()
    ).filter((section) => versionIds.has(section.versionId));
    const versionQuestions = (
      await ctx.db.query("schoolAssessmentVersionQuestions").collect()
    ).filter((question) => versionIds.has(question.versionId));

    const questionIds = new Set(questions.map((question) => question._id));
    const versionQuestionIds = new Set(
      versionQuestions.map((question) => question._id)
    );

    const choices = (
      await ctx.db.query("schoolAssessmentChoices").collect()
    ).filter((choice) => questionIds.has(choice.questionId));
    const versionChoices = (
      await ctx.db.query("schoolAssessmentVersionChoices").collect()
    ).filter((choice) => versionQuestionIds.has(choice.questionId));
    const rubricCriteria = (
      await ctx.db.query("schoolAssessmentRubricCriteria").collect()
    ).filter((criterion) => questionIds.has(criterion.questionId));
    const versionRubricCriteria = (
      await ctx.db.query("schoolAssessmentVersionRubricCriteria").collect()
    ).filter((criterion) => versionQuestionIds.has(criterion.questionId));

    await Promise.all([
      ...choices.map((choice) =>
        ctx.db.delete("schoolAssessmentChoices", choice._id)
      ),
      ...versionChoices.map((choice) =>
        ctx.db.delete("schoolAssessmentVersionChoices", choice._id)
      ),
      ...rubricCriteria.map((criterion) =>
        ctx.db.delete("schoolAssessmentRubricCriteria", criterion._id)
      ),
      ...versionRubricCriteria.map((criterion) =>
        ctx.db.delete("schoolAssessmentVersionRubricCriteria", criterion._id)
      ),
      ...questions.map((question) =>
        ctx.db.delete("schoolAssessmentQuestions", question._id)
      ),
      ...versionQuestions.map((question) =>
        ctx.db.delete("schoolAssessmentVersionQuestions", question._id)
      ),
      ...sections.map((section) =>
        ctx.db.delete("schoolAssessmentSections", section._id)
      ),
      ...versionSections.map((section) =>
        ctx.db.delete("schoolAssessmentVersionSections", section._id)
      ),
      ...versions.map((version) =>
        ctx.db.delete("schoolAssessmentVersions", version._id)
      ),
    ]);

    await ctx.db.delete("schoolAssessments", args.assessmentId);

    return null;
  },
});
