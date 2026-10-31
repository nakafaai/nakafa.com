import type { ContentSnapshotKind } from "@nakafa/aksara-contracts/release/snapshot/scope";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  loadRelease,
  loadState,
} from "@repo/backend/confect/contentRelease/model";
import { Array as Arr, Effect, MutableHashSet, Option } from "effect";

/**
 * Checks whether a try-out attempt still names one assessment snapshot. An
 * attempt freezes its paper and item versions from the snapshot and reads them
 * back for its review, so the snapshot stays while any attempt names it.
 */
const hasAttemptReference = Effect.fn("contentRelease.hasAttemptReference")(
  function* (snapshotId: string) {
    const attempt = yield* (yield* DatabaseReader)
      .table("tryoutAttempts")
      .index("by_assessmentSnapshotId", (query) =>
        query.eq("assessmentSnapshotId", snapshotId)
      )
      .first()
      .pipe(Effect.orDie);
    return Option.isSome(attempt);
  }
);

/** Collects every release ID whose stored history must stay reachable. */
const protectedReleases = Effect.fn("contentRelease.protectedSnapshotReleases")(
  function* () {
    const database = yield* DatabaseReader;
    const state = yield* loadState();
    const completed = yield* database
      .table("contentReleases")
      .index(
        "by_status_and_sequence",
        (query) => query.eq("status", "completed"),
        "desc"
      )
      .take(2)
      .pipe(Effect.orDie);
    const ids = MutableHashSet.fromIterable(
      Arr.filter(
        [
          state?.activeReleaseId,
          state?.candidateReleaseId,
          state?.recoveryReleaseId,
          ...Arr.map(completed, ({ releaseId }) => releaseId),
        ],
        (releaseId) => releaseId !== undefined
      )
    );
    for (const releaseId of [...ids]) {
      const release = yield* loadRelease(releaseId);
      const baseReleaseId = release.baseReleaseId;
      if (baseReleaseId !== null) {
        MutableHashSet.add(ids, baseReleaseId);
      }
    }
    return ids;
  }
);

/** Checks whether any retained release still selects one immutable snapshot. */
export const isSnapshotReferenced = Effect.fn(
  "contentRelease.isSnapshotReferenced"
)(function* (family: ContentSnapshotKind, snapshotId: string) {
  if (family === "assessment" && (yield* hasAttemptReference(snapshotId))) {
    return true;
  }
  const ids = yield* protectedReleases();
  for (const releaseId of ids) {
    const release = yield* loadRelease(releaseId);
    const state = release.snapshotTransitions[family];
    if (
      state.baseSnapshotId === snapshotId ||
      state.resultSnapshotId === snapshotId
    ) {
      return true;
    }
  }
  return false;
});
