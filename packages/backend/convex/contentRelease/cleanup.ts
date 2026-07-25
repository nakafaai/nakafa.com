import { MAX_CLEANUP_PAGE_COUNT } from "@nakafa/aksara-contracts/release/lifecycle";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { validateAbortedRelease } from "@repo/backend/convex/contentRelease/abort";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  loadRelease,
  loadState,
} from "@repo/backend/convex/contentRelease/model";
import { isArtifactReferenced } from "@repo/backend/convex/contentRelease/retention";
import {
  ARTIFACT_PAGE_BYTES,
  ARTIFACT_PAGE_COUNT,
  cleanupReceiptValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect } from "effect";

/** Validates server-owned cleanup counters before advancing a page. */
function cleanupCounters(release: Doc<"contentReleases">) {
  const deletedArtifacts = release.cleanupDeletedArtifacts ?? 0;
  if (!Number.isSafeInteger(deletedArtifacts) || deletedArtifacts < 0) {
    return null;
  }
  return { deletedArtifacts };
}

/** Builds exact cumulative evidence for one cleanup request. */
function cleanupReceipt(
  releaseId: string,
  complete: boolean,
  deletedArtifacts: number,
  retryAt?: number
) {
  if (retryAt === undefined) {
    return { complete, deletedArtifacts, releaseId };
  }
  return { complete, deletedArtifacts, releaseId, retryAt };
}

/** Proves only one detached aborted release may initiate artifact cleanup. */
const ensureEligible = Effect.fn("contentRelease.ensureCleanupEligible")(
  function* (ctx: MutationCtx, release: Doc<"contentReleases">) {
    const state = yield* loadState(ctx);
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
    yield* validateAbortedRelease(ctx, release.releaseId);
  }
);

/** Deletes one bounded artifact page while retaining every MVCC anchor. */
const cleanupProgram = Effect.fn("contentRelease.cleanup")(function* (
  ctx: MutationCtx,
  releaseId: string
) {
  const release = yield* loadRelease(ctx, releaseId);
  yield* ensureEligible(ctx, release);
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
  const now = Date.now();
  if (release.cleanupRetryAt !== undefined && now < release.cleanupRetryAt) {
    return cleanupReceipt(
      releaseId,
      false,
      counters.deletedArtifacts,
      release.cleanupRetryAt
    );
  }
  const page = yield* Effect.promise(() => {
    const cleanupHash = release.cleanupHash;
    const options = {
      cursor: null,
      maximumBytesRead: ARTIFACT_PAGE_BYTES,
      maximumRowsRead: ARTIFACT_PAGE_COUNT,
      numItems: Math.min(MAX_CLEANUP_PAGE_COUNT, ARTIFACT_PAGE_COUNT),
    };
    if (cleanupHash) {
      return ctx.db
        .query("contentArtifacts")
        .withIndex("by_artifactHash", (query) =>
          query.gt("artifactHash", cleanupHash)
        )
        .paginate(options);
    }
    return ctx.db
      .query("contentArtifacts")
      .withIndex("by_artifactHash")
      .paginate(options);
  });
  const rows = page.page;
  let deleted = 0;
  let futureAt = release.cleanupFutureAt;
  for (const artifact of rows) {
    if (yield* isArtifactReferenced(ctx, artifact.artifactHash)) {
      continue;
    }
    if (artifact.retainUntil > now) {
      futureAt = Math.min(
        futureAt ?? artifact.retainUntil,
        artifact.retainUntil
      );
      continue;
    }
    yield* Effect.promise(() =>
      ctx.db.delete("contentArtifacts", artifact._id)
    );
    deleted += 1;
  }
  const exhausted = page.isDone;
  const nextArtifacts = counters.deletedArtifacts + deleted;
  const complete = exhausted && futureAt === undefined;
  const nextRetry = exhausted ? futureAt : undefined;
  yield* Effect.promise(() =>
    ctx.db.patch("contentReleases", release._id, {
      cleanupAt: complete ? now : undefined,
      cleanupDeletedArtifacts: nextArtifacts,
      cleanupFutureAt: exhausted ? undefined : futureAt,
      cleanupHash: exhausted ? undefined : rows.at(-1)?.artifactHash,
      cleanupRetryAt: nextRetry,
      updatedAt: now,
    })
  );
  return cleanupReceipt(releaseId, complete, nextArtifacts, nextRetry);
});

/** Deletes one bounded page of artifacts unreachable from every MVCC slot. */
export const cleanup = internalMutation({
  args: { releaseId: v.string() },
  returns: cleanupReceiptValidator,
  handler: (ctx, args) => runConvexProgram(cleanupProgram(ctx, args.releaseId)),
});
