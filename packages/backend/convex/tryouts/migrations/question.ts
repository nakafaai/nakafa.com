import { tryoutPlacementIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type {
  TryoutChoice,
  TryoutPlacement,
} from "@nakafa/aksara-contracts/tryout/spec";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { toTryoutCorpusPath } from "@repo/backend/convex/contentRelease/tryout/path";
import { verifyTryoutPlacement } from "@repo/backend/convex/contentRelease/tryout/verify";
import { matchesSignedTryoutContent } from "@repo/backend/convex/tryouts/migrations/contentAttestation";
import { migrationFail } from "@repo/backend/convex/tryouts/migrations/spec";
import { Effect } from "effect";

type LegacyPlacement = Doc<"tryoutAttemptPlacements">;

/** Authenticates one frozen legacy placement against its signed replacement. */
export const bindLegacyPlacement = Effect.fn(
  "tryouts.migrations.bindLegacyPlacement"
)(function* (
  ctx: MutationCtx,
  expectedSnapshotId: string,
  legacy: LegacyPlacement
) {
  const legacyContentHash = legacy.contentHash;
  const tryoutSectionId = legacy.tryoutSectionId;
  if (!(tryoutSectionId && legacyContentHash)) {
    return yield* migrationFail(
      "A legacy placement is missing its source identity."
    );
  }

  const attempt = yield* Effect.promise(() =>
    ctx.db.get(legacy.tryoutAttemptId)
  );
  const countryKey = attempt?.countryKey;
  const examKey = attempt?.examKey;
  const locale = attempt?.locale;
  const setIdentity = attempt?.setIdentity;
  const setKey = attempt?.setKey;
  const trackKey = attempt?.trackKey;
  if (
    !attempt ||
    (attempt.tryoutSnapshotId !== undefined &&
      attempt.tryoutSnapshotId !== expectedSnapshotId) ||
    !countryKey ||
    !examKey ||
    !locale ||
    !setIdentity ||
    !setKey ||
    !trackKey
  ) {
    return yield* migrationFail(
      "A legacy placement's owning attempt is not prepared."
    );
  }
  const section = attempt.sectionSnapshots.find(
    (candidate) => candidate.tryoutSectionId === tryoutSectionId
  );
  if (!(section?.sectionIdentity && section.sectionRowHash)) {
    return yield* migrationFail(
      "A legacy placement's frozen section is not prepared."
    );
  }

  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutPlacements")
      .withIndex("by_snapshotId_and_section_and_questionOrder", (index) =>
        index
          .eq("snapshotId", expectedSnapshotId)
          .eq("locale", locale)
          .eq("countryKey", countryKey)
          .eq("examKey", examKey)
          .eq("trackKey", trackKey)
          .eq("setKey", setKey)
          .eq("sectionKey", section.sectionKey)
          .eq("questionOrder", legacy.questionOrder)
      )
      .unique()
  );
  if (!stored) {
    return yield* migrationFail("A signed try-out placement is missing.");
  }

  const row = yield* verifyTryoutPlacement(stored, expectedSnapshotId);
  if (!matchesLegacyPlacement(legacy, legacyContentHash, row)) {
    return yield* migrationFail(
      `Legacy placement ${stored.identity} differs from its signed row.`
    );
  }

  return {
    identity: tryoutPlacementIdentity(row),
    row,
    rowHash: stored.rowHash,
    sectionIdentity: section.sectionIdentity,
  };
});

/** Authenticates one legacy IRT item against its signed placement. */
export const bindLegacyIrtItem = Effect.fn(
  "tryouts.migrations.bindLegacyIrtItem"
)(function* (
  ctx: MutationCtx,
  expectedSnapshotId: string,
  item: Doc<"irtScaleItems">
) {
  const questionId = item.questionId;
  if (
    !(
      questionId &&
      item.questionSourceKey &&
      item.sourceRevision &&
      item.contentHash
    )
  ) {
    return yield* migrationFail(
      "A legacy IRT item lost its question identity."
    );
  }

  const question = yield* Effect.promise(() => ctx.db.get(questionId));
  if (
    !question ||
    question.sourceKey !== item.questionSourceKey ||
    question.sourceRevision !== item.sourceRevision ||
    question.contentHash !== item.contentHash
  ) {
    return yield* migrationFail("A legacy IRT item differs from its question.");
  }

  const section = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutSections")
      .withIndex("by_questionSetId", (index) =>
        index.eq("questionSetId", question.questionSetId)
      )
      .unique()
  );
  if (!section) {
    return yield* migrationFail("A legacy IRT section is missing.");
  }

  const placement = yield* bindQuestionPlacement(
    ctx,
    expectedSnapshotId,
    section,
    question.number
  );
  if (
    !matchesSignedTryoutContent(
      question.contentHash,
      placement.row.contentHash
    ) ||
    placement.row.sourceRevision !== question.sourceRevision ||
    placement.row.questionSourcePath !==
      toTryoutCorpusPath(question.sourcePath) ||
    placement.row.title !== question.title
  ) {
    return yield* migrationFail(
      "A legacy IRT question differs from its signed placement."
    );
  }

  return placement;
});

/** Loads one signed placement selected by a legacy section and question order. */
const bindQuestionPlacement = Effect.fn(
  "tryouts.migrations.bindQuestionPlacement"
)(function* (
  ctx: MutationCtx,
  expectedSnapshotId: string,
  section: Doc<"tryoutSections">,
  questionOrder: number
) {
  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutPlacements")
      .withIndex("by_snapshotId_and_section_and_questionOrder", (index) =>
        index
          .eq("snapshotId", expectedSnapshotId)
          .eq("locale", section.locale)
          .eq("countryKey", section.countryKey)
          .eq("examKey", section.examKey)
          .eq("trackKey", section.trackKey)
          .eq("setKey", section.setKey)
          .eq("sectionKey", section.sectionKey)
          .eq("questionOrder", questionOrder)
      )
      .unique()
  );
  if (!stored) {
    return yield* migrationFail("A signed IRT placement is missing.");
  }

  const row = yield* verifyTryoutPlacement(stored, expectedSnapshotId);
  return {
    identity: tryoutPlacementIdentity(row),
    row,
    rowHash: stored.rowHash,
  };
});

/** Checks one frozen legacy placement against its signed replacement. */
function matchesLegacyPlacement(
  legacy: LegacyPlacement,
  legacyContentHash: Doc<"questions">["contentHash"],
  row: TryoutPlacement
) {
  return (
    matchesSignedTryoutContent(legacyContentHash, row.contentHash) &&
    row.questionOrder === legacy.questionOrder &&
    row.questionSourcePath === toTryoutCorpusPath(legacy.sourcePath) &&
    row.sourceRevision === legacy.sourceRevision &&
    row.title === legacy.title &&
    choicesMatch(legacy.choiceSnapshots, row.choices)
  );
}

/** Compares frozen choices without depending on object property order. */
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
