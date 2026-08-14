import {
  tryoutCatalogIdentity,
  tryoutPlacementIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import {
  decodeHistoryRowJson,
  type HistoricalTryoutRow,
} from "@repo/backend/convex/tryouts/history/decode";
import {
  historyFail,
  type RetainedTryoutHistoryPlan,
} from "@repo/backend/convex/tryouts/history/spec";
import { Effect } from "effect";

type Attempt = Doc<"tryoutAttempts">;
type FrozenPlacement = Doc<"tryoutAttemptPlacements">;
type HistoryPlacement = Extract<
  Doc<"tryoutHistoryRows">,
  { readonly rowKind: "placement" }
>;
type SignedPlacement = Extract<
  HistoricalTryoutRow,
  { readonly rowKind: "placement" }
>;

export interface AuthenticatedHistoryPlacement {
  readonly history: HistoryPlacement;
  readonly signed: SignedPlacement;
}

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

/** Authenticates one standalone history placement for bounded preflight reads. */
export const authenticateHistoryPlacement = Effect.fn(
  "tryouts.history.authenticateHistoryPlacement"
)(function* (history: HistoryPlacement) {
  const decoded = yield* decodeHistoryRowJson(history.rowJson, history.rowHash);
  if (decoded.rowKind !== "placement") {
    return yield* historyFail(
      "TRYOUT_HISTORY_INTEGRITY",
      `History placement ${history.rowHash} has the wrong signed row kind.`
    );
  }
  return { history, signed: decoded } satisfies AuthenticatedHistoryPlacement;
});

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
