import { requireAssessment } from "@repo/backend/convex/assessments/helpers/access";
import { mutation } from "@repo/backend/convex/functions";
import { requireAuth } from "@repo/backend/convex/lib/helpers/auth";
import { requirePermission } from "@repo/backend/convex/lib/helpers/permissions";
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
    const assessment = await requireAssessment(
      ctx,
      args.schoolId,
      args.assessmentId
    );

    await requirePermission(ctx, "assessment:delete", {
      userId: user.appUser._id,
      schoolId: assessment.schoolId,
      classId: assessment.classId,
    });

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

    const [
      versions,
      sections,
      questions,
      versionSections,
      versionQuestions,
      choices,
      versionChoices,
      rubricCriteria,
      versionRubricCriteria,
    ] = await Promise.all([
      ctx.db
        .query("schoolAssessmentVersions")
        .withIndex("by_assessmentId_and_versionNumber", (q) =>
          q.eq("assessmentId", args.assessmentId)
        )
        .collect(),
      ctx.db
        .query("schoolAssessmentSections")
        .withIndex("by_assessmentId_and_order", (q) =>
          q.eq("assessmentId", args.assessmentId)
        )
        .collect(),
      ctx.db
        .query("schoolAssessmentQuestions")
        .withIndex("by_assessmentId_and_sectionId_and_order", (q) =>
          q.eq("assessmentId", args.assessmentId)
        )
        .collect(),
      ctx.db
        .query("schoolAssessmentVersionSections")
        .withIndex("by_assessmentId_and_versionId_and_order", (q) =>
          q.eq("assessmentId", args.assessmentId)
        )
        .collect(),
      ctx.db
        .query("schoolAssessmentVersionQuestions")
        .withIndex(
          "by_assessmentId_and_versionId_and_sectionId_and_order",
          (q) => q.eq("assessmentId", args.assessmentId)
        )
        .collect(),
      ctx.db
        .query("schoolAssessmentChoices")
        .withIndex("by_assessmentId_and_questionId_and_order", (q) =>
          q.eq("assessmentId", args.assessmentId)
        )
        .collect(),
      ctx.db
        .query("schoolAssessmentVersionChoices")
        .withIndex("by_assessmentId_and_questionId_and_order", (q) =>
          q.eq("assessmentId", args.assessmentId)
        )
        .collect(),
      ctx.db
        .query("schoolAssessmentRubricCriteria")
        .withIndex("by_assessmentId_and_questionId_and_order", (q) =>
          q.eq("assessmentId", args.assessmentId)
        )
        .collect(),
      ctx.db
        .query("schoolAssessmentVersionRubricCriteria")
        .withIndex("by_assessmentId_and_questionId_and_order", (q) =>
          q.eq("assessmentId", args.assessmentId)
        )
        .collect(),
    ]);

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
