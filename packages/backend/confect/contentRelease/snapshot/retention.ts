import type { ContentSnapshotKind } from "@nakafa/aksara-contracts/release/snapshot/scope";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import {
  loadHistoryFloor,
  loadRelease,
  loadState,
} from "@repo/backend/confect/contentRelease/model";
import { Array as Arr, Effect, MutableHashSet, Option } from "effect";

/** Checks permanent try-out state that still requires one snapshot. */
const hasTryoutRuntimeReference = Effect.fn(
  "contentRelease.hasTryoutRuntimeReference"
)(function* (snapshotId: string) {
  const database = yield* DatabaseReader;
  const [attempt, scale] = yield* Effect.all([
    database
      .table("tryoutAttempts")
      .index("by_tryoutSnapshotId", (query) =>
        query.eq("tryoutSnapshotId", snapshotId)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie),
    database
      .table("irtScaleVersions")
      .index(
        "by_tryoutSnapshotId_and_setIdentity_and_history_and_publishedAt",
        (query) => query.eq("tryoutSnapshotId", snapshotId)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie),
  ]);
  return attempt !== null || scale !== null;
});

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
  if (family === "tryout" && (yield* hasTryoutRuntimeReference(snapshotId))) {
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

/** Checks whether any immutable try-out placement owns an artifact. */
export const hasSnapshotArtifactReference = Effect.fn(
  "contentRelease.hasSnapshotArtifactReference"
)(function* (artifactHash: string) {
  const database = yield* DatabaseReader;
  const [question, answer] = yield* Effect.all([
    database
      .table("tryoutPlacements")
      .index("by_questionArtifactHash", (query) =>
        query.eq("questionArtifactHash", artifactHash)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie),
    database
      .table("tryoutPlacements")
      .index("by_answerArtifactHash", (query) =>
        query.eq("answerArtifactHash", artifactHash)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull), Effect.orDie),
  ]);
  return question !== null || answer !== null;
});
