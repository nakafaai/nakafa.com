import type { ContentSnapshotKind } from "@nakafa/aksara-contracts/release/snapshot/scope";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { loadHistoryFloor } from "@repo/backend/confect/contentRelease/compact/protected";
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
    const historyFloor = yield* loadHistoryFloor();
    const completed = yield* database
      .table("contentReleases")
      .index(
        "by_status_and_sequence",
        (query) => query.eq("status", "completed"),
        "desc"
      )
      .take(2)
      .pipe(Effect.orDie);
    const completedAboveFloor = Arr.filter(
      completed,
      (release) => release.sequence >= historyFloor
    );
    const ids = MutableHashSet.fromIterable(
      Arr.filter(
        [
          state?.activeReleaseId,
          state?.candidateReleaseId,
          state?.recoveryReleaseId,
          ...Arr.map(completedAboveFloor, ({ releaseId }) => releaseId),
        ],
        (releaseId) => releaseId !== undefined
      )
    );
    for (const releaseId of [...ids]) {
      const release = yield* loadRelease(releaseId);
      const baseReleaseId = release.baseReleaseId;
      // A bootstrap's base is the retired generation it replaced, never protected.
      if (baseReleaseId !== null && release.bootstrap !== true) {
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
    // A bootstrap's base snapshot belongs to the retired generation it replaced.
    const selectsBase =
      release.bootstrap !== true && state.baseSnapshotId === snapshotId;
    if (selectsBase || state.resultSnapshotId === snapshotId) {
      return true;
    }
  }
  return false;
});
