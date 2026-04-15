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

  const currentVersion = assessment.currentVersionId
    ? await ctx.db.get("schoolAssessmentVersions", assessment.currentVersionId)
    : null;

  const sections = await ctx.db
    .query("schoolAssessmentSections")
    .withIndex("by_assessmentId_and_order", (q) =>
      q.eq("assessmentId", assessmentId)
    )
    .collect();

  const questions = await ctx.db
    .query("schoolAssessmentQuestions")
    .withIndex("by_assessmentId_and_sectionId_and_order", (q) =>
      q.eq("assessmentId", assessmentId)
    )
    .collect();

  const questionIds = new Set(questions.map((question) => question._id));

  const [choices, rubricCriteria] = await Promise.all([
    collectRowsByQuestionId(ctx, "schoolAssessmentChoices", questionIds),
    collectRowsByQuestionId(ctx, "schoolAssessmentRubricCriteria", questionIds),
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

/** Collect all rows that belong to a known set of question ids. */
async function collectRowsByQuestionId<
  TableName extends
    | "schoolAssessmentChoices"
    | "schoolAssessmentRubricCriteria",
>(
  ctx: QueryCtx | MutationCtx,
  tableName: TableName,
  questionIds: Set<Id<"schoolAssessmentQuestions">>
) {
  const rows = await ctx.db.query(tableName).collect();

  return rows.filter((row) => questionIds.has(row.questionId));
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
