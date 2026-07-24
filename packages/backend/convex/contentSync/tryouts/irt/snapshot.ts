import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { IrtSyncSetProof } from "@repo/backend/convex/contentSync/tryouts/irt/spec";

type TryoutSet = Doc<"tryoutSets">;
type TryoutSection = Doc<"tryoutSections">;
type Question = Doc<"questions">;

/** One complete synchronized section and its ordered question rows. */
export interface IrtSectionSnapshot {
  readonly questions: Question[];
  readonly section: TryoutSection;
}

/** Loads the complete section and question snapshot for a set when available. */
export async function loadIrtSetSnapshot(ctx: MutationCtx, set: TryoutSet) {
  const sections = await ctx.db
    .query("tryoutSections")
    .withIndex("by_tryoutSetId_and_order", (query) =>
      query.eq("tryoutSetId", set._id)
    )
    .take(set.sectionCount + 1);

  if (sections.length !== set.sectionCount) {
    return null;
  }

  const snapshot = await Promise.all(
    sections.map(async (section) => ({
      questions: await loadSectionQuestions(ctx, section),
      section,
    }))
  );
  const totalQuestionCount = snapshot.reduce(
    (total, item) => total + item.questions.length,
    0
  );

  if (totalQuestionCount !== set.totalQuestionCount) {
    return null;
  }

  return snapshot;
}

/** Loads the latest scale version for one try-out set. */
export async function loadLatestIrtScale(
  ctx: MutationCtx,
  tryoutSetId: Id<"tryoutSets">
) {
  return await ctx.db
    .query("irtScaleVersions")
    .withIndex("by_tryoutSetId_and_publishedAt", (query) =>
      query.eq("tryoutSetId", tryoutSetId)
    )
    .order("desc")
    .first();
}

/** Returns true when the scale covers the exact signed question snapshot. */
export async function irtScaleMatchesSnapshot(
  ctx: MutationCtx,
  args: {
    proof: IrtSyncSetProof;
    scaleId: Id<"irtScaleVersions">;
    snapshot: IrtSectionSnapshot[];
    totalQuestionCount: number;
  }
) {
  const items = await ctx.db
    .query("irtScaleItems")
    .withIndex("by_scaleVersionId_and_questionSourceKey", (query) =>
      query.eq("scaleVersionId", args.scaleId)
    )
    .take(args.totalQuestionCount + 1);

  if (items.length !== args.totalQuestionCount) {
    return false;
  }

  const itemsBySourceKey = new Map(
    items.map((item) => [item.questionSourceKey, item])
  );
  const runs = await Promise.all(
    [...new Set(items.map(({ calibrationRunId }) => calibrationRunId))].map(
      (runId) => ctx.db.get(runId)
    )
  );
  const runsById = new Map<
    Id<"irtCalibrationRuns">,
    Doc<"irtCalibrationRuns">
  >();
  for (const run of runs) {
    if (run) {
      runsById.set(run._id, run);
    }
  }
  const placementsBySourceKey = new Map(
    args.proof.sections.flatMap((section) =>
      section.placements.map((placement) => [
        placement.questionSourceKey,
        {
          ...placement,
          sectionIdentity: section.sectionIdentity,
        },
      ])
    )
  );

  return args.snapshot.every(({ questions }) =>
    questions.every((question) =>
      questionMatchesSnapshot(
        itemsBySourceKey.get(question.sourceKey),
        placementsBySourceKey.get(question.sourceKey),
        question,
        runsById
      )
    )
  );
}

/** Loads all questions for one synchronized section or an empty partial row. */
async function loadSectionQuestions(ctx: MutationCtx, section: TryoutSection) {
  const questions = await ctx.db
    .query("questions")
    .withIndex("by_questionSetId_and_number", (query) =>
      query.eq("questionSetId", section.questionSetId)
    )
    .take(section.questionCount + 1);

  if (questions.length !== section.questionCount) {
    return [];
  }

  return questions;
}

/** Verifies one scale item against its signed source question snapshot. */
function questionMatchesSnapshot(
  item: Doc<"irtScaleItems"> | undefined,
  placement:
    | (IrtSyncSetProof["sections"][number]["placements"][number] & {
        readonly sectionIdentity: string;
      })
    | undefined,
  question: Question,
  runsById: ReadonlyMap<Id<"irtCalibrationRuns">, Doc<"irtCalibrationRuns">>
) {
  if (!(item && placement)) {
    return false;
  }

  const run = runsById.get(item.calibrationRunId);
  return (
    item.contentHash === question.contentHash &&
    item.placementIdentity === placement.placementIdentity &&
    item.placementRowHash === placement.placementRowHash &&
    item.questionId === question._id &&
    item.sourceRevision === question.sourceRevision &&
    run?.scaleVersionId === item.scaleVersionId &&
    run.sectionIdentity === placement.sectionIdentity
  );
}
