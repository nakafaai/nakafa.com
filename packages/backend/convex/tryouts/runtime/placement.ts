import {
  tryoutCatalogIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { TRYOUT_CHOICE_LIMIT } from "@repo/backend/convex/tryouts/questions";
import type { TryoutSectionSource } from "@repo/backend/convex/tryouts/start/source";
import {
  TryoutStartError,
  toTryoutStartError,
  tryoutStartErrorCode,
} from "@repo/backend/convex/tryouts/start/spec";
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

/** Loads the live legacy section row backing an attempt snapshot. */
export async function requireSnapshotSection(
  ctx: MutationCtx,
  args: {
    attempt: TryoutAttempt;
    snapshot: TryoutSectionSnapshot;
  }
): Promise<TryoutSection> {
  const section = await ctx.db.get(args.snapshot.tryoutSectionId);

  if (
    !section ||
    section.tryoutSetId !== args.attempt.tryoutSetId ||
    section.sectionKey !== args.snapshot.sectionKey ||
    section.questionSetId !== args.snapshot.questionSetId ||
    section.questionSourcePath !== args.snapshot.questionSourcePath ||
    section.questionCount !== args.snapshot.questionCount ||
    section.sourceRevision !== args.snapshot.sourceRevision
  ) {
    throw new ConvexError({
      code: "TRYOUT_SECTION_NOT_FOUND",
      message: "Try-out section not found.",
    });
  }

  return section;
}

/** Freezes the selected local or authenticated signed placement snapshot. */
export const createAttemptPlacements = Effect.fn(
  "tryouts.runtime.createAttemptPlacements"
)(function* (
  ctx: MutationCtx,
  args: {
    readonly attempt: TryoutAttempt;
    readonly source: TryoutSectionSource;
  }
) {
  if (args.source.kind === "local") {
    yield* createLocalPlacements(ctx, args.attempt, args.source.sections);
    return;
  }

  for (const source of args.source.sections) {
    const sectionIdentity = tryoutCatalogIdentity(source.signed.section.row);
    const snapshot = args.attempt.sectionSnapshots.find(
      (candidate) => candidate.tryoutSectionId === source.legacy._id
    );
    if (
      !snapshot ||
      snapshot.sectionIdentity !== sectionIdentity ||
      snapshot.sectionRowHash !== source.signed.section.rowHash ||
      snapshot.questionCount !== source.signed.placements.length
    ) {
      return yield* startMismatch(
        "Try-out section changed before its attempt was frozen."
      );
    }

    for (const placement of source.signed.placements) {
      yield* tryStartPromise(() =>
        ctx.db.insert("tryoutAttemptPlacements", {
          answerArtifactHash: placement.row.answerArtifactHash,
          answerContentKey: placement.row.answerContentKey,
          choiceSnapshots: [...placement.row.choices],
          contentHash: placement.row.contentHash,
          placementIdentity: tryoutPlacementIdentity(placement.row),
          placementRowHash: placement.rowHash,
          questionArtifactHash: placement.row.questionArtifactHash,
          questionContentKey: placement.row.questionContentKey,
          questionOrder: placement.row.questionOrder,
          rendererDomain: placement.row.rendererDomain,
          sectionIdentity,
          sectionKey: placement.row.sectionKey,
          sourcePath: placement.row.questionSourcePath,
          sourceRevision: placement.row.sourceRevision,
          title: placement.row.title,
          tryoutAttemptId: args.attempt._id,
          tryoutSectionId: source.legacy._id,
        })
      );
    }
  }
});

/** Freezes the current local rows before signed ownership is activated. */
const createLocalPlacements = Effect.fn(
  "tryouts.runtime.createLocalPlacements"
)(function* (
  ctx: MutationCtx,
  attempt: TryoutAttempt,
  sections: readonly TryoutSection[]
) {
  for (const section of sections) {
    const questions = yield* loadSectionQuestions(ctx, section);
    for (const question of questions) {
      const choiceSnapshots = yield* loadChoiceSnapshots(ctx, question);
      yield* tryStartPromise(() =>
        ctx.db.insert("tryoutAttemptPlacements", {
          choiceSnapshots,
          contentHash: question.contentHash,
          questionId: question._id,
          questionOrder: question.number,
          questionSourceKey: question.sourceKey,
          sourcePath: question.sourcePath,
          sourceRevision: question.sourceRevision,
          title: question.title,
          tryoutAttemptId: attempt._id,
          tryoutSectionId: section._id,
        })
      );
    }
  }
});

/** Loads the ordered legacy questions for one aligned section. */
const loadSectionQuestions = Effect.fn("tryouts.runtime.loadSectionQuestions")(
  function* (ctx: MutationCtx, section: TryoutSection) {
    const questions = yield* tryStartPromise(() =>
      ctx.db
        .query("questions")
        .withIndex("by_questionSetId_and_number", (query) =>
          query.eq("questionSetId", section.questionSetId)
        )
        .take(section.questionCount + 1)
    );
    if (
      questions.length !== section.questionCount ||
      questions.some(
        (question) => question.sourceRevision !== section.sourceRevision
      )
    ) {
      return yield* startMismatch(
        "Try-out section questions are not fully synced."
      );
    }
    return questions;
  }
);

/** Loads one deterministic legacy choice snapshot. */
const loadChoiceSnapshots = Effect.fn("tryouts.runtime.loadChoiceSnapshots")(
  function* (ctx: MutationCtx, question: TryoutQuestion) {
    const choices = yield* tryStartPromise(() =>
      ctx.db
        .query("questionChoices")
        .withIndex("by_questionId_and_locale", (query) =>
          query.eq("questionId", question._id).eq("locale", question.locale)
        )
        .take(TRYOUT_CHOICE_LIMIT + 1)
    );
    if (choices.length === 0 || choices.length > TRYOUT_CHOICE_LIMIT) {
      return yield* startMismatch(
        "Try-out question choice count is outside the supported range."
      );
    }
    return choices
      .map(({ isCorrect, label, optionKey, order }) => ({
        isCorrect,
        label,
        optionKey,
        order,
      }))
      .sort((left, right) => left.order - right.order);
  }
);

/** Creates one typed fail-closed snapshot mismatch. */
function startMismatch(message: string) {
  return new TryoutStartError({
    code: tryoutStartErrorCode.sectionSnapshotMismatch,
    message,
  });
}

/** Lifts one Convex promise into the typed start failure channel. */
function tryStartPromise<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({ catch: toTryoutStartError, try: operation });
}
