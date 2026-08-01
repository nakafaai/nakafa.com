import { snapshotRowCount } from "@nakafa/aksara-contracts/release/snapshot";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadStaged } from "@repo/backend/convex/contentRelease/model";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import { hasProofTransactionHeadroom } from "@repo/backend/convex/contentRelease/proof/budget";
import { validateContentOwners } from "@repo/backend/convex/contentRelease/scope/owner";
import {
  PROOF_PAGE_BYTES,
  PROOF_PAGE_LIMIT,
  progressValidator,
} from "@repo/backend/convex/contentRelease/spec";
import { checkItem } from "@repo/backend/convex/contentRelease/verify/item";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect } from "effect";

/** Freezes a complete staged release before any cross-transaction proof read. */
export const beginVerification = Effect.fn("contentRelease.beginVerification")(
  function* (ctx: MutationCtx, releaseId: string) {
    const { release } = yield* loadStaged(ctx, releaseId);
    if (release.status === "verifying" || release.status === "verified") {
      return release.checkedIndex;
    }
    const signed = yield* decodeReleaseJson(release.releaseJson);
    yield* validateContentOwners(ctx, release, signed.manifest);
    const complete =
      release.status === "staging" &&
      release.abortingAt === undefined &&
      release.stagedItems === signed.manifest.itemCount &&
      release.stagedDeletes === signed.manifest.deleteCount &&
      release.stagedUpserts === signed.manifest.upsertCount &&
      release.stagedArtifacts === signed.manifest.upsertCount &&
      release.stagedProjections === signed.manifest.projectionCount &&
      release.stagedRoutes === signed.manifest.routeCount &&
      release.stagedSnapshotRows ===
        snapshotRowCount(signed.manifest.snapshots);
    if (!complete) {
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Content release ${releaseId} is not completely staged for verification.`
      );
    }
    yield* Effect.promise(() =>
      ctx.db.patch("contentReleases", release._id, {
        status: "verifying",
        updatedAt: Date.now(),
      })
    );
    return release.checkedIndex;
  }
);

/** Verifies one resumable contiguous page before proof can be committed. */
const verifyProgram = Effect.fn("contentRelease.verifyItems")(function* (
  ctx: MutationCtx,
  releaseId: string,
  afterIndex: number
) {
  const { release } = yield* loadStaged(ctx, releaseId);
  if (release.status === "verified") {
    return { done: true, nextIndex: release.checkedIndex, processed: 0 };
  }
  if (
    release.abortingAt !== undefined ||
    release.status !== "verifying" ||
    !Number.isSafeInteger(afterIndex) ||
    afterIndex < -1
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Content release ${releaseId} cannot verify from its current state.`
    );
  }
  if (afterIndex !== release.checkedIndex) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      `Content release ${releaseId} expected verification cursor ${release.checkedIndex}.`
    );
  }
  const signed = yield* decodeReleaseJson(release.releaseJson);
  const rows = yield* Effect.promise(() =>
    ctx.db
      .query("contentItems")
      .withIndex("by_releaseId_and_index", (query) =>
        query.eq("releaseId", releaseId).gt("index", afterIndex)
      )
      .paginate({
        cursor: null,
        maximumBytesRead: PROOF_PAGE_BYTES,
        maximumRowsRead: PROOF_PAGE_LIMIT,
        numItems: PROOF_PAGE_LIMIT,
      })
  );
  let processed = 0;
  let nextIndex = release.checkedIndex;
  for (const row of rows.page) {
    const offset = processed;
    const expectedIndex = release.checkedItems + offset;
    if (row.index !== expectedIndex) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content release ${releaseId} expected item ${expectedIndex}, received ${row.index}.`
      );
    }
    yield* checkItem(ctx, row);
    processed += 1;
    nextIndex = row.index;
    const metrics = yield* Effect.promise(() =>
      ctx.meta.getTransactionMetrics()
    );
    if (!hasProofTransactionHeadroom(metrics)) {
      break;
    }
  }
  const checkedItems = release.checkedItems + processed;
  const done = rows.isDone && processed === rows.page.length;
  if (done && checkedItems !== signed.manifest.itemCount) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Content release ${releaseId} verified ${checkedItems} of ${signed.manifest.itemCount} items.`
    );
  }
  yield* Effect.promise(() =>
    ctx.db.patch("contentReleases", release._id, {
      checkedIndex: nextIndex,
      checkedItems,
      status: "verifying",
      updatedAt: Date.now(),
    })
  );
  return { done, nextIndex, processed };
});

/** Verifies one bounded item page and returns a durable continuation index. */
export const verifyItems = internalMutation({
  args: { afterIndex: v.number(), releaseId: v.string() },
  returns: progressValidator,
  handler: (ctx, args) =>
    runConvexProgram(verifyProgram(ctx, args.releaseId, args.afterIndex)),
});
