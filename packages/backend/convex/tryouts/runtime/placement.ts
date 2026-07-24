import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { getUnknownErrorMessage } from "@repo/backend/convex/lib/effect";
import { TRYOUT_CHOICE_LIMIT } from "@repo/backend/convex/tryouts/questions";
import { loadActiveAttemptSet } from "@repo/backend/convex/tryouts/snapshot/catalog";
import { loadStablePlacement } from "@repo/backend/convex/tryouts/snapshot/placement";
import {
  type ActiveTryoutSet,
  TryoutSnapshotError,
  tryoutSnapshotFail,
} from "@repo/backend/convex/tryouts/snapshot/spec";
import { ConvexError } from "convex/values";
import { Effect } from "effect";

type TryoutAttempt = Doc<"tryoutAttempts">;
type TryoutQuestion = Doc<"questions">;
type TryoutSection = Doc<"tryoutSections">;
type TryoutSectionSnapshot = TryoutAttempt["sectionSnapshots"][number];

/** Loads the immutable section snapshot for one attempt section key. */
export function requireSectionSnapshot(
  attempt: TryoutAttempt,
  sectionKey: string
): TryoutSectionSnapshot {
  const snapshot = attempt.sectionSnapshots.find(
    (section) => section.sectionKey === sectionKey
  );

  if (!snapshot) {
    throw new ConvexError({
      code: "TRYOUT_SECTION_NOT_FOUND",
      message: "Try-out section is not part of this attempt.",
    });
  }

  return snapshot;
}

/** Loads the live section row backing an attempt snapshot. */
const requireSnapshotSection = Effect.fn(
  "tryouts.snapshot.requireLegacySection"
)(function* (
  ctx: MutationCtx,
  args: {
    attempt: TryoutAttempt;
    snapshot: TryoutSectionSnapshot;
  }
) {
  const section = yield* tryPlacementPromise(() =>
    ctx.db.get(args.snapshot.tryoutSectionId)
  );
  if (
    !section ||
    section.tryoutSetId !== args.attempt.tryoutSetId ||
    section.sectionKey !== args.snapshot.sectionKey ||
    section.questionSetId !== args.snapshot.questionSetId ||
    section.questionSourcePath !== args.snapshot.questionSourcePath ||
    section.questionCount !== args.snapshot.questionCount ||
    section.sourceRevision !== args.snapshot.sourceRevision
  ) {
    return yield* tryoutSnapshotFail(
      "TRYOUT_SECTION_NOT_FOUND",
      "Try-out section not found."
    );
  }
  return section;
});

/** Freezes every question placement when an attempt starts. */
export const createAttemptPlacements = Effect.fn(
  "tryouts.snapshot.createPlacements"
)(function* (ctx: MutationCtx, args: { attempt: TryoutAttempt }) {
  const active = yield* loadActiveAttemptSet(ctx, args.attempt);
  for (const snapshot of args.attempt.sectionSnapshots) {
    const section = yield* requireSnapshotSection(ctx, {
      attempt: args.attempt,
      snapshot,
    });
    yield* createSectionPlacements(ctx, {
      active,
      attempt: args.attempt,
      section,
    });
  }
});

/** Creates the immutable placements for one snapshotted section. */
const createSectionPlacements = Effect.fn(
  "tryouts.snapshot.createSectionPlacements"
)(function* (
  ctx: MutationCtx,
  args: {
    active: ActiveTryoutSet;
    attempt: TryoutAttempt;
    section: TryoutSection;
  }
) {
  const questions = yield* loadSectionQuestions(ctx, args.section);
  const snapshots = yield* Effect.forEach(
    questions,
    (question) =>
      loadChoiceSnapshots(ctx, question).pipe(
        Effect.map((choiceSnapshots) => ({ choiceSnapshots, question }))
      ),
    { concurrency: "unbounded" }
  );

  for (const snapshot of snapshots) {
    const { choiceSnapshots, question } = snapshot;
    const stable = yield* loadStablePlacement(
      ctx,
      args.active.snapshotId,
      args.active.set,
      args.section.sectionKey,
      {
        answerContentKey: `${question.sourcePath}/answer`,
        choices: choiceSnapshots,
        locale: question.locale,
        questionContentKey: `${question.sourcePath}/question`,
        questionOrder: question.number,
        sourceRevision: question.sourceRevision,
        title: question.title,
      }
    );
    yield* tryPlacementPromise(() =>
      ctx.db.insert("tryoutAttemptPlacements", {
        answerArtifactHash: stable.row.answerArtifactHash,
        answerContentKey: stable.row.answerContentKey,
        choiceSnapshots,
        contentHash: question.contentHash,
        placementIdentity: stable.identity,
        placementRowHash: stable.rowHash,
        questionArtifactHash: stable.row.questionArtifactHash,
        questionContentKey: stable.row.questionContentKey,
        questionId: question._id,
        questionOrder: question.number,
        questionSourceKey: question.sourceKey,
        rendererDomain: stable.row.rendererDomain,
        sectionKey: stable.row.sectionKey,
        sourcePath: question.sourcePath,
        sourceRevision: question.sourceRevision,
        title: question.title,
        tryoutAttemptId: args.attempt._id,
        tryoutSectionId: args.section._id,
      })
    );
  }
});

/** Loads the ordered question rows for one section. */
const loadSectionQuestions = Effect.fn("tryouts.snapshot.loadQuestions")(
  function* (ctx: MutationCtx, section: TryoutSection) {
    const questions = yield* tryPlacementPromise(() =>
      ctx.db
        .query("questions")
        .withIndex("by_questionSetId_and_number", (query) =>
          query.eq("questionSetId", section.questionSetId)
        )
        .take(section.questionCount + 1)
    );
    if (questions.length !== section.questionCount) {
      return yield* tryoutSnapshotFail(
        "TRYOUT_QUESTION_COUNT_MISMATCH",
        "Try-out section question count is not synced."
      );
    }
    if (
      questions.some(
        (question) => question.sourceRevision !== section.sourceRevision
      )
    ) {
      return yield* tryoutSnapshotFail(
        "TRYOUT_QUESTION_SNAPSHOT_MISMATCH",
        "Try-out section questions are not fully synced."
      );
    }
    return questions;
  }
);

/** Loads the ordered choice snapshot for one runtime placement. */
const loadChoiceSnapshots = Effect.fn("tryouts.snapshot.loadChoices")(
  function* (ctx: MutationCtx, question: TryoutQuestion) {
    const choices = yield* tryPlacementPromise(() =>
      ctx.db
        .query("questionChoices")
        .withIndex("by_questionId_and_locale", (query) =>
          query.eq("questionId", question._id).eq("locale", question.locale)
        )
        .take(TRYOUT_CHOICE_LIMIT + 1)
    );
    if (choices.length > TRYOUT_CHOICE_LIMIT) {
      return yield* tryoutSnapshotFail(
        "TRYOUT_CHOICE_COUNT_EXCEEDED",
        "Try-out question choice count exceeds the sync limit."
      );
    }
    if (choices.length === 0) {
      return yield* tryoutSnapshotFail(
        "TRYOUT_CHOICE_COUNT_MISMATCH",
        "Try-out question has no synced choices."
      );
    }
    return choices
      .map((choice) => ({
        isCorrect: choice.isCorrect,
        label: choice.label,
        optionKey: choice.optionKey,
        order: choice.order,
      }))
      .sort((left, right) => left.order - right.order);
  }
);

/** Lifts one Convex operation into the signed-snapshot failure channel. */
function tryPlacementPromise<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({
    catch: (error) =>
      new TryoutSnapshotError({
        code: "TRYOUT_SNAPSHOT_WRITE_FAILED",
        message: getUnknownErrorMessage(error),
      }),
    try: operation,
  });
}
