import {
  tryoutCatalogIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import type { TryoutChoice } from "@nakafa/aksara-contracts/tryout/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { toTryoutCorpusPath } from "@repo/backend/convex/contentRelease/tryout/path";
import { TRYOUT_CHOICE_LIMIT } from "@repo/backend/convex/tryouts/questions";
import type { AlignedTryoutSection } from "@repo/backend/convex/tryouts/start/source";
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

/** Freezes signed identities and legacy question state into new placements. */
export const createAttemptPlacements = Effect.fn(
  "tryouts.runtime.createAttemptPlacements"
)(function* (
  ctx: MutationCtx,
  args: {
    readonly attempt: TryoutAttempt;
    readonly sections: readonly AlignedTryoutSection[];
  }
) {
  for (const source of args.sections) {
    const sectionIdentity = tryoutCatalogIdentity(source.signed.section.row);
    const snapshot = args.attempt.sectionSnapshots.find(
      (candidate) => candidate.tryoutSectionId === source.legacy._id
    );
    if (
      !snapshot ||
      snapshot.sectionIdentity !== sectionIdentity ||
      snapshot.sectionRowHash !== source.signed.section.rowHash
    ) {
      return yield* startMismatch(
        "Try-out section changed before its attempt was frozen."
      );
    }

    const questions = yield* loadSectionQuestions(ctx, source.legacy);
    for (const [index, question] of questions.entries()) {
      const placement = source.signed.placements[index];
      if (!placement) {
        return yield* startMismatch(
          "Try-out signed placement count changed before attempt creation."
        );
      }
      const choices = yield* loadChoiceSnapshots(ctx, question);
      if (!matchesPlacement(source.legacy, question, choices, placement.row)) {
        return yield* startMismatch(
          `Try-out question ${question.number} differs from its signed placement.`
        );
      }

      yield* tryStartPromise(() =>
        ctx.db.insert("tryoutAttemptPlacements", {
          answerArtifactHash: placement.row.answerArtifactHash,
          answerContentKey: placement.row.answerContentKey,
          choiceSnapshots: choices,
          contentHash: question.contentHash,
          placementIdentity: tryoutPlacementIdentity(placement.row),
          placementRowHash: placement.rowHash,
          questionArtifactHash: placement.row.questionArtifactHash,
          questionContentKey: placement.row.questionContentKey,
          questionId: question._id,
          questionOrder: question.number,
          questionSourceKey: question.sourceKey,
          rendererDomain: placement.row.rendererDomain,
          sectionIdentity,
          sectionKey: source.legacy.sectionKey,
          sourcePath: question.sourcePath,
          sourceRevision: question.sourceRevision,
          title: question.title,
          tryoutAttemptId: args.attempt._id,
          tryoutSectionId: source.legacy._id,
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

/** Checks one legacy question snapshot against its signed placement. */
function matchesPlacement(
  section: TryoutSection,
  question: TryoutQuestion,
  choices: readonly TryoutChoice[],
  signed: AlignedTryoutSection["signed"]["placements"][number]["row"]
) {
  return (
    signed.sectionKey === section.sectionKey &&
    signed.questionOrder === question.number &&
    signed.questionSourcePath === toTryoutCorpusPath(question.sourcePath) &&
    signed.sourceRevision === question.sourceRevision &&
    signed.title === question.title &&
    choicesMatch(choices, signed.choices)
  );
}

/** Compares ordered choices without relying on object property order. */
function choicesMatch(
  legacy: readonly TryoutChoice[],
  signed: readonly TryoutChoice[]
) {
  return (
    legacy.length === signed.length &&
    legacy.every((choice, index) => {
      const candidate = signed[index];
      return (
        candidate !== undefined &&
        candidate.isCorrect === choice.isCorrect &&
        candidate.label === choice.label &&
        candidate.optionKey === choice.optionKey &&
        candidate.order === choice.order
      );
    })
  );
}

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
