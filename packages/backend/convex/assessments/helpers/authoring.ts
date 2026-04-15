import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";

/** Load one authored assessment tree for the editor. */
export async function loadAuthoredAssessment(
  ctx: QueryCtx | MutationCtx,
  assessmentId: Id<"schoolAssessments">
) {
  const assessment = await ctx.db.get("schoolAssessments", assessmentId);

  if (!assessment) {
    return null;
  }

  const [currentVersion, sections, questions, choices, rubricCriteria] =
    await Promise.all([
      assessment.currentVersionId
        ? ctx.db.get("schoolAssessmentVersions", assessment.currentVersionId)
        : Promise.resolve(null),
      ctx.db
        .query("schoolAssessmentSections")
        .withIndex("by_assessmentId_and_order", (q) =>
          q.eq("assessmentId", assessmentId)
        )
        .collect(),
      ctx.db
        .query("schoolAssessmentQuestions")
        .withIndex("by_assessmentId_and_sectionId_and_order", (q) =>
          q.eq("assessmentId", assessmentId)
        )
        .collect(),
      ctx.db
        .query("schoolAssessmentChoices")
        .withIndex("by_assessmentId_and_questionId_and_order", (q) =>
          q.eq("assessmentId", assessmentId)
        )
        .collect(),
      ctx.db
        .query("schoolAssessmentRubricCriteria")
        .withIndex("by_assessmentId_and_questionId_and_order", (q) =>
          q.eq("assessmentId", assessmentId)
        )
        .collect(),
    ]);

  return {
    assessment,
    currentVersion,
    sections,
    questions,
    choices,
    rubricCriteria,
  };
}

/** Compute the next version number for one authored assessment. */
export async function getNextAssessmentVersionNumber(
  ctx: QueryCtx | MutationCtx,
  assessmentId: Id<"schoolAssessments">
) {
  const latestVersion = await ctx.db
    .query("schoolAssessmentVersions")
    .withIndex("by_assessmentId_and_versionNumber", (q) =>
      q.eq("assessmentId", assessmentId)
    )
    .order("desc")
    .first();

  return (latestVersion?.versionNumber ?? 0) + 1;
}

/** Sum all authored question points for one immutable version. */
export function getTotalVersionPoints(
  questions: Doc<"schoolAssessmentQuestions">[]
) {
  return questions.reduce((total, question) => total + question.points, 0);
}
