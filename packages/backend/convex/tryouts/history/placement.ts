import {
  tryoutCatalogIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { HistoricalTryoutRow } from "@repo/backend/convex/tryouts/history/decode";
import {
  historyFail,
  type RetainedTryoutHistoryPlan,
} from "@repo/backend/convex/tryouts/history/spec";
import { Effect, Schema } from "effect";

type Attempt = Pick<
  Doc<"tryoutAttempts">,
  | "_id"
  | "appLocale"
  | "countryKey"
  | "examKey"
  | "locale"
  | "setIdentity"
  | "setKey"
  | "snapshotReleaseId"
  | "trackKey"
  | "tryoutSnapshotId"
>;
type FrozenPlacement = Pick<
  Doc<"tryoutAttemptPlacements">,
  | "_id"
  | "answerArtifactHash"
  | "answerContentKey"
  | "choiceSnapshots"
  | "contentHash"
  | "placementIdentity"
  | "placementRowHash"
  | "questionArtifactHash"
  | "questionContentKey"
  | "questionOrder"
  | "rendererDomain"
  | "sectionIdentity"
  | "sectionKey"
  | "sourcePath"
  | "sourceRevision"
  | "title"
  | "tryoutAttemptId"
>;
type HistoryPlacement = Pick<
  Extract<Doc<"tryoutHistoryRows">, { readonly rowKind: "placement" }>,
  | "answerArtifactHash"
  | "index"
  | "questionArtifactHash"
  | "rowHash"
  | "rowJson"
  | "rowKind"
  | "snapshotId"
>;
type SignedPlacement = Extract<
  HistoricalTryoutRow,
  { readonly rowKind: "placement" }
>;
type HistoricalTryoutPlacement = SignedPlacement["record"]["row"];
type FrozenStoredPlacement = Pick<
  FrozenPlacement,
  | "answerArtifactHash"
  | "answerContentKey"
  | "choiceSnapshots"
  | "contentHash"
  | "questionArtifactHash"
  | "questionContentKey"
  | "questionOrder"
  | "rendererDomain"
  | "sectionKey"
  | "sourcePath"
  | "sourceRevision"
  | "title"
>;

export interface AuthenticatedHistoryPlacement {
  readonly history: HistoryPlacement;
  readonly signed: SignedPlacement;
}

/** Facts exposed only after an old row matches its attempt-owned frozen copy. */
export interface VerifiedStoredTryoutPlacement {
  readonly answerArtifactHash: HistoricalTryoutPlacement["answerArtifactHash"];
  readonly answerContentKey: HistoricalTryoutPlacement["answerContentKey"];
  readonly artifactLocale: HistoricalTryoutPlacement["locale"];
  readonly contentHash: FrozenPlacement["contentHash"];
  readonly questionArtifactHash: HistoricalTryoutPlacement["questionArtifactHash"];
  readonly questionContentKey: HistoricalTryoutPlacement["questionContentKey"];
  readonly questionOrder: HistoricalTryoutPlacement["questionOrder"];
  readonly questionSourcePath: HistoricalTryoutPlacement["questionSourcePath"];
  readonly sourceRevision: HistoricalTryoutPlacement["sourceRevision"];
}

/** One authenticated old placement differs from its attempt-owned frozen row. */
export class StoredTryoutPlacementMismatchError extends Schema.TaggedError<StoredTryoutPlacementMismatchError>()(
  "StoredTryoutPlacementMismatchError",
  {}
) {}

/** Checks the exact ordered choice snapshot stored on one retained attempt. */
function hasExactChoices(
  frozen: FrozenPlacement["choiceSnapshots"],
  signed: readonly FrozenPlacement["choiceSnapshots"][number][]
) {
  return (
    frozen.length === signed.length &&
    frozen.every((choice, index) => {
      const expected = signed[index];
      return (
        expected !== undefined &&
        choice.isCorrect === expected.isCorrect &&
        choice.label === expected.label &&
        choice.optionKey === expected.optionKey &&
        choice.order === expected.order
      );
    })
  );
}

/** Accepts the two exact frozen encodings: 1,220 rooted and 500 root-relative. */
function hasExactHistoricalSourcePath(
  frozenSourcePath: string,
  signedSourcePath: string
) {
  return (
    frozenSourcePath === signedSourcePath ||
    `packages/corpus/${frozenSourcePath}` === signedSourcePath
  );
}

/** Proves one frozen placement still equals its authenticated signed source. */
export const verifyFrozenPlacement = Effect.fn(
  "tryouts.history.verifyFrozenPlacement"
)(function* (
  attempt: Attempt,
  frozen: FrozenPlacement,
  authenticated: AuthenticatedHistoryPlacement,
  plan: RetainedTryoutHistoryPlan
) {
  const { history, signed } = authenticated;
  const row = signed.record.row;
  const placementIdentity = tryoutPlacementIdentity(row);
  const sectionIdentity = tryoutCatalogIdentity({
    countryKey: row.countryKey,
    examKey: row.examKey,
    kind: "section",
    locale: row.locale,
    sectionKey: row.sectionKey,
    setKey: row.setKey,
    trackKey: row.trackKey,
  });
  const setIdentity = tryoutCatalogIdentity({
    countryKey: row.countryKey,
    examKey: row.examKey,
    kind: "set",
    locale: row.locale,
    setKey: row.setKey,
    trackKey: row.trackKey,
  });
  const releaseIsRetained = plan.releases.some(
    ({ releaseId }) => releaseId === attempt.snapshotReleaseId
  );

  // The signed migration deliberately preserved each pre-signing contentHash.
  // placementRowHash authenticates the later signed row without rewriting it.
  if (
    history.snapshotId !== plan.snapshotId ||
    history.rowHash !== signed.record.rowHash ||
    history.questionArtifactHash !== row.questionArtifactHash ||
    history.answerArtifactHash !== row.answerArtifactHash ||
    attempt.tryoutSnapshotId !== plan.snapshotId ||
    !releaseIsRetained ||
    attempt.appLocale !== attempt.locale ||
    attempt.locale !== row.locale ||
    attempt.countryKey !== row.countryKey ||
    attempt.examKey !== row.examKey ||
    attempt.trackKey !== row.trackKey ||
    attempt.setKey !== row.setKey ||
    attempt.setIdentity !== setIdentity ||
    frozen.tryoutAttemptId !== attempt._id ||
    frozen.placementIdentity !== placementIdentity ||
    frozen.placementRowHash !== signed.record.rowHash ||
    frozen.answerArtifactHash !== row.answerArtifactHash ||
    frozen.answerContentKey !== row.answerContentKey ||
    frozen.questionArtifactHash !== row.questionArtifactHash ||
    frozen.questionContentKey !== row.questionContentKey ||
    frozen.rendererDomain !== row.rendererDomain ||
    frozen.sectionIdentity !== sectionIdentity ||
    frozen.sectionKey !== row.sectionKey ||
    frozen.questionOrder !== row.questionOrder ||
    !hasExactHistoricalSourcePath(frozen.sourcePath, row.questionSourcePath) ||
    frozen.sourceRevision !== row.sourceRevision ||
    frozen.title !== row.title ||
    !hasExactChoices(frozen.choiceSnapshots, row.choices)
  ) {
    return yield* historyFail(
      "TRYOUT_HISTORY_NOT_READY",
      `Frozen placement ${frozen._id} no longer matches ${placementIdentity}.`
    );
  }
});

/** Proves one authenticated old placement still matches its frozen attempt row. */
export const verifyStoredTryoutPlacement = Effect.fn(
  "tryouts.history.verifyStoredPlacement"
)(function* (
  historical: HistoricalTryoutPlacement,
  frozen: FrozenStoredPlacement
) {
  const matchesFrozen =
    historical.answerArtifactHash === frozen.answerArtifactHash &&
    historical.answerContentKey === frozen.answerContentKey &&
    historical.questionArtifactHash === frozen.questionArtifactHash &&
    historical.questionContentKey === frozen.questionContentKey &&
    historical.questionOrder === frozen.questionOrder &&
    hasExactHistoricalSourcePath(
      frozen.sourcePath,
      historical.questionSourcePath
    ) &&
    historical.rendererDomain === frozen.rendererDomain &&
    historical.sectionKey === frozen.sectionKey &&
    historical.sourceRevision === frozen.sourceRevision &&
    historical.title === frozen.title &&
    hasExactChoices(frozen.choiceSnapshots, historical.choices);
  if (!matchesFrozen) {
    return yield* new StoredTryoutPlacementMismatchError();
  }

  return {
    answerArtifactHash: historical.answerArtifactHash,
    answerContentKey: historical.answerContentKey,
    artifactLocale: historical.locale,
    contentHash: frozen.contentHash,
    questionArtifactHash: historical.questionArtifactHash,
    questionContentKey: historical.questionContentKey,
    questionOrder: historical.questionOrder,
    questionSourcePath: historical.questionSourcePath,
    sourceRevision: historical.sourceRevision,
  } satisfies VerifiedStoredTryoutPlacement;
});
