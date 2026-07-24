import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { decodeSnapshotRowJson } from "@repo/backend/convex/contentRelease/parse";
import { loadActiveSnapshot } from "@repo/backend/convex/contentRelease/runtime/snapshot";
import {
  type ActiveTryoutSet,
  type StableTryoutSet,
  type TryoutSectionEvidence,
  type TryoutSetEvidence,
  tryoutSnapshotFail,
} from "@repo/backend/convex/tryouts/snapshot/spec";
import { Effect } from "effect";

type ReadCtx = MutationCtx | QueryCtx;
type LegacySet = Doc<"tryoutSets">;
type StableAttempt = Doc<"tryoutAttempts"> &
  Required<
    Pick<
      Doc<"tryoutAttempts">,
      | "countryKey"
      | "examKey"
      | "locale"
      | "setIdentity"
      | "setKey"
      | "trackKey"
      | "tryoutSnapshotId"
    >
  >;

/** Decodes one physical try-out row without exposing parser failures. */
const decodeTryoutRow = Effect.fn("tryouts.snapshot.decodeCatalogRow")(
  (rowJson: string) =>
    decodeSnapshotRowJson(rowJson).pipe(
      Effect.catchAll(() =>
        tryoutSnapshotFail(
          "TRYOUT_SNAPSHOT_INVALID",
          "The active try-out snapshot contains an invalid row."
        )
      )
    )
);

/** Resolves one legacy set to its exact immutable Aksara catalog identity. */
export const loadStableSet = Effect.fn("tryouts.snapshot.loadStableSet")(
  function* (ctx: ReadCtx, snapshotId: string, set: TryoutSetEvidence) {
    const identity = tryoutCatalogIdentity({
      countryKey: set.countryKey,
      examKey: set.examKey,
      kind: "set",
      locale: set.locale,
      setKey: set.setKey,
      trackKey: set.trackKey,
    });
    const stored = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_identity", (query) =>
          query.eq("snapshotId", snapshotId).eq("identity", identity)
        )
        .unique()
    );
    if (!stored) {
      return yield* tryoutSnapshotFail(
        "TRYOUT_SNAPSHOT_SET_MISSING",
        `Snapshot ${snapshotId} does not contain set ${identity}.`
      );
    }
    const decoded = yield* decodeTryoutRow(stored.rowJson);
    if (
      decoded.family !== "tryout" ||
      decoded.rowKind !== "catalog" ||
      decoded.record.row.kind !== "set" ||
      decoded.record.rowHash !== stored.rowHash ||
      tryoutCatalogIdentity(decoded.record.row) !== identity
    ) {
      return yield* tryoutSnapshotFail(
        "TRYOUT_SNAPSHOT_SET_INVALID",
        `Snapshot ${snapshotId} set ${identity} is not self-consistent.`
      );
    }
    const row = decoded.record.row;
    if (
      row.publicPath !== set.publicPath ||
      row.sourceRevision !== set.sourceRevision ||
      row.scoringStrategy !== set.scoringStrategy ||
      row.questionCount !== set.totalQuestionCount ||
      row.sectionCount !== set.sectionCount
    ) {
      return yield* tryoutSnapshotFail(
        "TRYOUT_SNAPSHOT_SET_MISMATCH",
        `Snapshot ${snapshotId} set ${identity} differs from synchronized state.`
      );
    }
    return {
      countryKey: row.countryKey,
      examKey: row.examKey,
      identity,
      locale: row.locale,
      setKey: row.setKey,
      trackKey: row.trackKey,
    } satisfies StableTryoutSet;
  }
);

/** Verifies that every synchronized section exists unchanged in Aksara. */
export const verifyStableSections = Effect.fn(
  "tryouts.snapshot.verifyStableSections"
)(function* (
  ctx: ReadCtx,
  snapshotId: string,
  stableSet: StableTryoutSet,
  sections: readonly TryoutSectionEvidence[]
) {
  for (const section of sections) {
    const identity = tryoutCatalogIdentity({
      ...stableSet,
      kind: "section",
      sectionKey: section.sectionKey,
    });
    const stored = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_identity", (query) =>
          query.eq("snapshotId", snapshotId).eq("identity", identity)
        )
        .unique()
    );
    if (!stored) {
      return yield* tryoutSnapshotFail(
        "TRYOUT_SNAPSHOT_SECTION_MISSING",
        `Snapshot ${snapshotId} does not contain section ${identity}.`
      );
    }
    const decoded = yield* decodeTryoutRow(stored.rowJson);
    if (
      decoded.family !== "tryout" ||
      decoded.rowKind !== "catalog" ||
      decoded.record.row.kind !== "section" ||
      decoded.record.rowHash !== stored.rowHash ||
      tryoutCatalogIdentity(decoded.record.row) !== identity
    ) {
      return yield* tryoutSnapshotFail(
        "TRYOUT_SNAPSHOT_SECTION_INVALID",
        `Snapshot ${snapshotId} section ${identity} is invalid.`
      );
    }
    const row = decoded.record.row;
    if (
      row.questionCount !== section.questionCount ||
      row.sourceRevision !== section.sourceRevision ||
      row.timeLimitSeconds !== section.timeLimitSeconds
    ) {
      return yield* tryoutSnapshotFail(
        "TRYOUT_SNAPSHOT_SECTION_MISMATCH",
        `Snapshot ${snapshotId} section ${identity} differs from synchronized state.`
      );
    }
  }
});

/** Resolves and verifies one set from the proof-verified active snapshot. */
export const loadActiveTryoutSet = Effect.fn("tryouts.snapshot.loadActiveSet")(
  function* (
    ctx: ReadCtx,
    set: LegacySet,
    sections: readonly TryoutSectionEvidence[]
  ) {
    const active = yield* loadActiveSnapshot(ctx, "tryout");
    if (!active) {
      return yield* tryoutSnapshotFail(
        "TRYOUT_SNAPSHOT_REQUIRED",
        "A verified active try-out snapshot is required."
      );
    }
    const stableSet = yield* loadStableSet(ctx, active.snapshotId, set);
    yield* verifyStableSections(ctx, active.snapshotId, stableSet, sections);
    return {
      set: stableSet,
      snapshotId: active.snapshotId,
    } satisfies ActiveTryoutSet;
  }
);

/** Checks one attempt root against the deterministic synchronized set identity. */
export function hasStableAttemptSet(
  attempt: Doc<"tryoutAttempts">,
  set: LegacySet
): attempt is StableAttempt {
  const identity = tryoutCatalogIdentity({
    countryKey: set.countryKey,
    examKey: set.examKey,
    kind: "set",
    locale: set.locale,
    setKey: set.setKey,
    trackKey: set.trackKey,
  });
  return (
    attempt.tryoutSetId === set._id &&
    attempt.tryoutSnapshotId !== undefined &&
    attempt.setIdentity === identity &&
    attempt.countryKey === set.countryKey &&
    attempt.examKey === set.examKey &&
    attempt.trackKey === set.trackKey &&
    attempt.setKey === set.setKey &&
    attempt.locale === set.locale
  );
}

/** Revalidates one durable attempt against its exact active signed snapshot. */
export const loadActiveAttemptSet = Effect.fn(
  "tryouts.snapshot.loadActiveAttemptSet"
)(function* (ctx: ReadCtx, attempt: Doc<"tryoutAttempts">) {
  const snapshotId = attempt.tryoutSnapshotId;
  const set = yield* Effect.promise(() => ctx.db.get(attempt.tryoutSetId));
  if (!(snapshotId && set)) {
    return yield* tryoutSnapshotFail(
      "TRYOUT_SNAPSHOT_ATTEMPT_REQUIRED",
      `Attempt ${attempt._id} does not have a complete signed snapshot root.`
    );
  }
  const active = yield* loadActiveSnapshot(ctx, "tryout");
  if (!active || active.snapshotId !== snapshotId) {
    return yield* tryoutSnapshotFail(
      "TRYOUT_SNAPSHOT_ATTEMPT_INACTIVE",
      `Attempt ${attempt._id} does not use the active try-out snapshot.`
    );
  }
  const stableSet = yield* loadStableSet(ctx, snapshotId, set);
  if (!hasStableAttemptSet(attempt, set)) {
    return yield* tryoutSnapshotFail(
      "TRYOUT_SNAPSHOT_ATTEMPT_MISMATCH",
      `Attempt ${attempt._id} differs from its signed set identity.`
    );
  }
  yield* verifyStableSections(
    ctx,
    snapshotId,
    stableSet,
    attempt.sectionSnapshots
  );
  return { set: stableSet, snapshotId } satisfies ActiveTryoutSet;
});
