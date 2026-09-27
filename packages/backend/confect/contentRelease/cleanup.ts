import { MAX_CLEANUP_PAGE_COUNT } from "@nakafa/aksara-contracts/release/lifecycle";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { validateAbortedRelease } from "@repo/backend/confect/contentRelease/abort";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import {
  loadRelease,
  loadState,
} from "@repo/backend/confect/contentRelease/model";
import { isArtifactReferenced } from "@repo/backend/confect/contentRelease/retention";
import {
  ARTIFACT_PAGE_BYTES,
  ARTIFACT_PAGE_COUNT,
} from "@repo/backend/confect/contentRelease/spec";
import { Clock, Effect } from "effect";

/** Validates server-owned cleanup counters before advancing a page. */
export function cleanupCounters(release: Docs["contentReleases"]) {
  const deletedArtifacts = release.cleanupDeletedArtifacts ?? 0;
  if (!Number.isSafeInteger(deletedArtifacts) || deletedArtifacts < 0) {
    return null;
  }
  return {
    deletedArtifacts,
  };
}

/** Builds exact cumulative evidence for one cleanup request. */
export function cleanupReceipt(
  releaseId: string,
  complete: boolean,
  deletedArtifacts: number,
  retryAt?: number
) {
  if (retryAt === undefined) {
    return {
      complete,
      deletedArtifacts,
      releaseId,
    };
  }
  return {
    complete,
    deletedArtifacts,
    releaseId,
    retryAt,
  };
}

/** Proves only one detached aborted release may initiate artifact cleanup. */
export const ensureEligible = Effect.fn("contentRelease.ensureCleanupEligible")(
  function* (release: Docs["contentReleases"]) {
    const state = yield* loadState();
    if (
      release.status !== "aborted" ||
      state?.activeReleaseId === release.releaseId ||
      state?.candidateReleaseId === release.releaseId ||
      state?.recoveryReleaseId === release.releaseId
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Release ${release.releaseId} is not unreachable cleanup state.`
      );
    }
    yield* validateAbortedRelease(release.releaseId);
  }
);

/** Deletes one bounded artifact page while retaining every MVCC anchor. */
export const cleanupProgram = Effect.fn("contentRelease.cleanup")(function* (
  releaseId: string
) {
  const writer = yield* DatabaseWriter;
  const release = yield* loadRelease(releaseId);
  yield* ensureEligible(release);
  const counters = cleanupCounters(release);
  if (!counters) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Release ${releaseId} has invalid cleanup counters.`
    );
  }
  if (release.cleanupAt !== undefined) {
    return cleanupReceipt(releaseId, true, counters.deletedArtifacts);
  }
  const now = yield* Clock.currentTimeMillis;
  if (release.cleanupRetryAt !== undefined && now < release.cleanupRetryAt) {
    return cleanupReceipt(
      releaseId,
      false,
      counters.deletedArtifacts,
      release.cleanupRetryAt
    );
  }
  const cleanupHash = release.cleanupHash;
  const page = yield* (yield* DatabaseReader)
    .table("contentArtifacts")
    .index("by_artifactHash", (query) =>
      cleanupHash ? query.gt("artifactHash", cleanupHash) : query
    )
    .paginate({
      cursor: null,
      maximumBytesRead: ARTIFACT_PAGE_BYTES,
      maximumRowsRead: ARTIFACT_PAGE_COUNT,
      numItems: Math.min(MAX_CLEANUP_PAGE_COUNT, ARTIFACT_PAGE_COUNT),
    })
    .pipe(Effect.orDie);
  const rows = page.page;
  let deleted = 0;
  let futureAt = release.cleanupFutureAt;
  for (const artifact of rows) {
    if (yield* isArtifactReferenced(artifact.artifactHash)) {
      continue;
    }
    if (artifact.retainUntil > now) {
      futureAt = Math.min(
        futureAt ?? artifact.retainUntil,
        artifact.retainUntil
      );
      continue;
    }
    yield* writer.table("contentArtifacts").delete(artifact._id);
    deleted += 1;
  }
  const exhausted = page.isDone;
  const nextArtifacts = counters.deletedArtifacts + deleted;
  const complete = exhausted && futureAt === undefined;
  const nextRetry = exhausted ? futureAt : undefined;
  yield* writer
    .table("contentReleases")
    .patch(release._id, {
      cleanupAt: complete ? now : undefined,
      cleanupDeletedArtifacts: nextArtifacts,
      cleanupFutureAt: exhausted ? undefined : futureAt,
      cleanupHash: exhausted ? undefined : rows.at(-1)?.artifactHash,
      cleanupRetryAt: nextRetry,
      updatedAt: now,
    })
    .pipe(Effect.orDie);
  return cleanupReceipt(releaseId, complete, nextArtifacts, nextRetry);
});
