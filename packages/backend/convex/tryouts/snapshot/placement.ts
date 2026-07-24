import {
  tryoutCatalogIdentity,
  tryoutPlacementIdentity,
  tryoutPlacementParentIdentity,
} from "@nakafa/aksara-contracts/tryout/identity";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { decodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import {
  type StableTryoutPlacement,
  type StableTryoutSet,
  type TryoutPlacementEvidence,
  tryoutSnapshotFail,
} from "@repo/backend/convex/tryouts/snapshot/spec";
import { Effect } from "effect";

type ReadCtx = MutationCtx | QueryCtx;

/** Resolves one question to its exact signed Aksara placement row. */
export const loadStablePlacement = Effect.fn(
  "tryouts.snapshot.loadStablePlacement"
)(function* (
  ctx: ReadCtx,
  snapshotId: string,
  stableSet: StableTryoutSet,
  sectionKey: string,
  evidence: TryoutPlacementEvidence
) {
  const parentKey = tryoutCatalogIdentity({
    ...stableSet,
    kind: "section",
    sectionKey,
  });
  const stored = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutPlacements")
      .withIndex("by_snapshotId_and_parentKey_and_questionOrder", (query) =>
        query
          .eq("snapshotId", snapshotId)
          .eq("parentKey", parentKey)
          .eq("questionOrder", evidence.questionOrder)
      )
      .unique()
  );
  if (!stored) {
    return yield* tryoutSnapshotFail(
      "TRYOUT_SNAPSHOT_PLACEMENT_MISSING",
      `Snapshot ${snapshotId} does not contain placement ${parentKey}/${evidence.questionOrder}.`
    );
  }
  const decoded = yield* decodeSnapshotRowJson(stored.rowJson).pipe(
    Effect.catchAll(() =>
      tryoutSnapshotFail(
        "TRYOUT_SNAPSHOT_PLACEMENT_INVALID",
        `Snapshot ${snapshotId} placement ${stored.identity} is invalid.`
      )
    )
  );
  if (
    decoded.family !== "tryout" ||
    decoded.rowKind !== "placement" ||
    decoded.record.rowHash !== stored.rowHash
  ) {
    return yield* tryoutSnapshotFail(
      "TRYOUT_SNAPSHOT_PLACEMENT_INVALID",
      `Snapshot ${snapshotId} placement ${stored.identity} is invalid.`
    );
  }
  const row = decoded.record.row;
  if (
    tryoutPlacementIdentity(row) !== stored.identity ||
    tryoutPlacementParentIdentity(row) !== parentKey ||
    row.answerContentKey !== evidence.answerContentKey ||
    row.questionContentKey !== evidence.questionContentKey ||
    row.locale !== evidence.locale ||
    row.sourceRevision !== evidence.sourceRevision ||
    row.title !== evidence.title ||
    !sameChoices(row.choices, evidence.choices)
  ) {
    return yield* tryoutSnapshotFail(
      "TRYOUT_SNAPSHOT_PLACEMENT_MISMATCH",
      `Snapshot ${snapshotId} placement ${stored.identity} differs from synchronized state.`
    );
  }
  return {
    identity: stored.identity,
    row,
    rowHash: stored.rowHash,
  } satisfies StableTryoutPlacement;
});

/** Compares exact signed choices with synchronized question choices. */
function sameChoices(
  signed: TryoutPlacementEvidence["choices"],
  synchronized: TryoutPlacementEvidence["choices"]
) {
  return (
    signed.length === synchronized.length &&
    signed.every((choice, index) => {
      const current = synchronized.at(index);
      return (
        current !== undefined &&
        current.isCorrect === choice.isCorrect &&
        current.label === choice.label &&
        current.optionKey === choice.optionKey &&
        current.order === choice.order
      );
    })
  );
}
