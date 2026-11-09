import type { ContentSnapshotKind } from "@nakafa/aksara-contracts/release/snapshot/scope";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  loadRelease,
  loadState,
} from "@repo/backend/confect/contentRelease/model";
import { Array as Arr, Effect, MutableHashSet, Option } from "effect";

/**
 * Checks whether a try-out attempt or a practice session still names one
 * assessment snapshot. Each freezes its item versions from the snapshot and
 * reads them back, an attempt for its review and a session for its questions
 * (ADR 0044), so the snapshot stays while either names it.
 */
const hasLearnerReference = Effect.fn("contentRelease.hasLearnerReference")(
  function* (snapshotId: string) {
    const database = yield* DatabaseReader;
    const attempt = yield* database
      .table("tryoutAttempts")
      .index("by_assessmentSnapshotId", (query) =>
        query.eq("assessmentSnapshotId", snapshotId)
      )
      .first()
      .pipe(Effect.orDie);
    if (Option.isSome(attempt)) {
      return true;
    }
    const session = yield* database
      .table("practiceSessions")
      .index("by_assessmentSnapshotId", (query) =>
        query.eq("assessmentSnapshotId", snapshotId)
      )
      .first()
      .pipe(Effect.orDie);
    return Option.isSome(session);
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
  if (family === "assessment" && (yield* hasLearnerReference(snapshotId))) {
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
