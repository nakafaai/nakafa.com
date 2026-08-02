import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

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
export const syncIrtScaleForSet = Effect.fn("contentSync.tryout.syncIrtScale")(
  function* (ctx: MutationCtx, args: { set: TryoutSet; syncedAt: number }) {
    if (args.set.scoringStrategy !== "irt") {
      return;
    }

    const snapshot = yield* loadSetSnapshot(ctx, args.set);

    if (!snapshot) {
      return;
    }

    const currentScale = yield* loadLatestScale(ctx, args.set._id);

    if (
      currentScale &&
      (yield* scaleMatchesSnapshot(ctx, {
        scaleId: currentScale._id,
        snapshot,
        totalQuestionCount: args.set.totalQuestionCount,
      }))
    ) {
      return;
    }

    yield* insertScaleSnapshot(ctx, {
      set: args.set,
      snapshot,
      syncedAt: args.syncedAt,
    });
  }
);

/** Loads the complete section and question snapshot for a set when available. */
const loadSetSnapshot = Effect.fn("contentSync.tryout.loadSetSnapshot")(
  function* (ctx: MutationCtx, set: TryoutSet) {
    const sections = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutSections")
        .withIndex("by_tryoutSetId_and_order", (query) =>
          query.eq("tryoutSetId", set._id)
        )
        .take(set.sectionCount + 1)
    );

    if (sections.length !== set.sectionCount) {
      return null;
    }

    const snapshot = yield* Effect.all(
      sections.map((section) =>
        loadSectionQuestions(ctx, section).pipe(
          Effect.map((questions) => ({ questions, section }))
        )
      )
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
);

/** Loads all questions for one synced section or returns an empty partial result. */
const loadSectionQuestions = Effect.fn(
  "contentSync.tryout.loadSectionQuestions"
)(function* (ctx: MutationCtx, section: TryoutSection) {
  const questions = yield* Effect.promise(() =>
    ctx.db
      .query("questions")
      .withIndex("by_questionSetId_and_number", (query) =>
        query.eq("questionSetId", section.questionSetId)
      )
      .take(section.questionCount + 1)
  );

  if (questions.length !== section.questionCount) {
    return [];
  }

  return questions;
});

/** Loads the latest scale version for one try-out set. */
const loadLatestScale = Effect.fn("contentSync.tryout.loadLatestScale")(
  (ctx: MutationCtx, tryoutSetId: Id<"tryoutSets">) =>
    Effect.promise(() =>
      ctx.db
        .query("irtScaleVersions")
        .withIndex("by_tryoutSetId_and_publishedAt", (query) =>
          query.eq("tryoutSetId", tryoutSetId)
        )
        .order("desc")
        .first()
    )
);

/** Returns true when the scale covers the exact current question snapshot. */
const scaleMatchesSnapshot = Effect.fn(
  "contentSync.tryout.scaleMatchesSnapshot"
)(function* (
  ctx: MutationCtx,
  args: {
    scaleId: Id<"irtScaleVersions">;
    snapshot: SectionSnapshot[];
    totalQuestionCount: number;
  }
) {
  const items = yield* Effect.promise(() =>
    ctx.db
      .query("irtScaleItems")
      .withIndex("by_scaleVersionId_and_questionSourceKey", (query) =>
        query.eq("scaleVersionId", args.scaleId)
      )
      .take(args.totalQuestionCount + 1)
  );

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
});

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
const insertScaleSnapshot = Effect.fn("contentSync.tryout.insertScaleSnapshot")(
  function* (
    ctx: MutationCtx,
    args: {
      set: TryoutSet;
      snapshot: SectionSnapshot[];
      syncedAt: number;
    }
  ) {
    const scaleVersionId = yield* Effect.promise(() =>
      ctx.db.insert("irtScaleVersions", {
        model: IRT_MODEL,
        publishedAt: args.syncedAt,
        questionCount: args.set.totalQuestionCount,
        status: "provisional",
        tryoutSetId: args.set._id,
      })
    );

    for (const item of args.snapshot) {
      yield* insertSectionScaleItems(ctx, {
        scaleVersionId,
        section: item.section,
        questions: item.questions,
        syncedAt: args.syncedAt,
      });
    }
  }
);

/** Inserts provisional IRT item parameters for one section snapshot. */
const insertSectionScaleItems = Effect.fn(
  "contentSync.tryout.insertSectionScaleItems"
)(function* (
  ctx: MutationCtx,
  args: {
    scaleVersionId: Id<"irtScaleVersions">;
    section: TryoutSection;
    questions: Question[];
    syncedAt: number;
  }
) {
  const calibrationRunId = yield* Effect.promise(() =>
    ctx.db.insert("irtCalibrationRuns", {
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
    })
  );

  for (const question of args.questions) {
    yield* insertQuestionScaleItem(ctx, {
      calibrationRunId,
      question,
      scaleVersionId: args.scaleVersionId,
    });
  }
});

/** Inserts one provisional IRT item from one synced question row. */
const insertQuestionScaleItem = Effect.fn(
  "contentSync.tryout.insertQuestionScaleItem"
)(function* (
  ctx: MutationCtx,
  args: {
    calibrationRunId: Id<"irtCalibrationRuns">;
    question: Question;
    scaleVersionId: Id<"irtScaleVersions">;
  }
) {
  yield* Effect.promise(() =>
    ctx.db.insert("irtScaleItems", {
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
    })
  );
});
