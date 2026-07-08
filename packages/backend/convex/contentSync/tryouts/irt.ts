import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";

const IRT_MODEL = "2pl";
const PROVISIONAL_DIFFICULTY = 0;
const PROVISIONAL_DISCRIMINATION = 1;

type TryoutSet = Doc<"tryoutSets">;
type TryoutSection = Doc<"tryoutSections">;
type Question = Doc<"questions">;

interface SectionSnapshot {
  questions: Question[];
  section: TryoutSection;
}

/** Provisions a provisional IRT scale from the exact synced question snapshot. */
export async function syncIrtScaleForSet(
  ctx: MutationCtx,
  args: { set: TryoutSet; syncedAt: number }
) {
  if (args.set.scoringStrategy !== "irt") {
    return;
  }

  const snapshot = await loadSetSnapshot(ctx, args.set);

  if (!snapshot) {
    return;
  }

  const currentScale = await loadLatestScale(ctx, args.set._id);

  if (
    currentScale &&
    (await scaleMatchesSnapshot(ctx, {
      scaleId: currentScale._id,
      snapshot,
      totalQuestionCount: args.set.totalQuestionCount,
    }))
  ) {
    return;
  }

  await insertScaleSnapshot(ctx, {
    set: args.set,
    snapshot,
    syncedAt: args.syncedAt,
  });
}

/** Loads the complete section and question snapshot for a set when available. */
async function loadSetSnapshot(ctx: MutationCtx, set: TryoutSet) {
  const sections = await ctx.db
    .query("tryoutSections")
    .withIndex("by_tryoutSetId_and_order", (q) => q.eq("tryoutSetId", set._id))
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

/** Loads all questions for one synced section or returns an empty partial result. */
async function loadSectionQuestions(ctx: MutationCtx, section: TryoutSection) {
  const questions = await ctx.db
    .query("questions")
    .withIndex("by_questionSetId_and_number", (q) =>
      q.eq("questionSetId", section.questionSetId)
    )
    .take(section.questionCount + 1);

  if (questions.length !== section.questionCount) {
    return [];
  }

  return questions;
}

/** Loads the latest scale version for one try-out set. */
async function loadLatestScale(
  ctx: MutationCtx,
  tryoutSetId: Id<"tryoutSets">
) {
  return await ctx.db
    .query("irtScaleVersions")
    .withIndex("by_tryoutSetId_and_publishedAt", (q) =>
      q.eq("tryoutSetId", tryoutSetId)
    )
    .order("desc")
    .first();
}

/** Returns true when the scale covers the exact current question snapshot. */
async function scaleMatchesSnapshot(
  ctx: MutationCtx,
  args: {
    scaleId: Id<"irtScaleVersions">;
    snapshot: SectionSnapshot[];
    totalQuestionCount: number;
  }
) {
  const items = await ctx.db
    .query("irtScaleItems")
    .withIndex("by_scaleVersionId_and_questionSourceKey", (q) =>
      q.eq("scaleVersionId", args.scaleId)
    )
    .take(args.totalQuestionCount + 1);

  if (items.length !== args.totalQuestionCount) {
    return false;
  }

  const itemsBySourceKey = new Map(
    items.map((item) => [item.questionSourceKey, item])
  );

  return args.snapshot.every(({ questions }) =>
    questions.every((question) =>
      matchesQuestionSnapshot(
        itemsBySourceKey.get(question.sourceKey),
        question
      )
    )
  );
}

/** Verifies that one scale item matches its source question snapshot. */
function matchesQuestionSnapshot(
  item: Doc<"irtScaleItems"> | undefined,
  question: Question
) {
  if (!item) {
    return false;
  }

  return (
    item.contentHash === question.contentHash &&
    item.questionId === question._id &&
    item.sourceRevision === question.sourceRevision
  );
}

/** Inserts one provisional scale version and its section calibration rows. */
async function insertScaleSnapshot(
  ctx: MutationCtx,
  args: {
    set: TryoutSet;
    snapshot: SectionSnapshot[];
    syncedAt: number;
  }
) {
  const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
    model: IRT_MODEL,
    publishedAt: args.syncedAt,
    questionCount: args.set.totalQuestionCount,
    status: "provisional",
    tryoutSetId: args.set._id,
  });

  for (const item of args.snapshot) {
    await insertSectionScaleItems(ctx, {
      scaleVersionId,
      section: item.section,
      questions: item.questions,
      syncedAt: args.syncedAt,
    });
  }
}

/** Inserts provisional IRT item parameters for one section snapshot. */
async function insertSectionScaleItems(
  ctx: MutationCtx,
  args: {
    scaleVersionId: Id<"irtScaleVersions">;
    section: TryoutSection;
    questions: Question[];
    syncedAt: number;
  }
) {
  const calibrationRunId = await ctx.db.insert("irtCalibrationRuns", {
    attemptCount: 0,
    completedAt: args.syncedAt,
    iterationCount: 0,
    maxParameterDelta: 0,
    model: IRT_MODEL,
    questionCount: args.questions.length,
    responseCount: 0,
    startedAt: args.syncedAt,
    status: "completed",
    tryoutSectionId: args.section._id,
    updatedAt: args.syncedAt,
  });

  for (const question of args.questions) {
    await insertQuestionScaleItem(ctx, {
      calibrationRunId,
      question,
      scaleVersionId: args.scaleVersionId,
    });
  }
}

/** Inserts one provisional IRT item from one synced question row. */
async function insertQuestionScaleItem(
  ctx: MutationCtx,
  args: {
    calibrationRunId: Id<"irtCalibrationRuns">;
    question: Question;
    scaleVersionId: Id<"irtScaleVersions">;
  }
) {
  await ctx.db.insert("irtScaleItems", {
    calibrationRunId: args.calibrationRunId,
    calibrationStatus: "provisional",
    contentHash: args.question.contentHash,
    correctRate: 0,
    difficulty: PROVISIONAL_DIFFICULTY,
    discrimination: PROVISIONAL_DISCRIMINATION,
    questionId: args.question._id,
    questionSourceKey: args.question.sourceKey,
    responseCount: 0,
    scaleVersionId: args.scaleVersionId,
    sourceRevision: args.question.sourceRevision,
  });
}
