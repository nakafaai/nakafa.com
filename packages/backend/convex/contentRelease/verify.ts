import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadStaged } from "@repo/backend/convex/contentRelease/model";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import {
  progressValidator,
  RELEASE_PAGE_LIMIT,
} from "@repo/backend/convex/contentRelease/spec";
import { checkItem } from "@repo/backend/convex/contentRelease/verify/item";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect } from "effect";

/** Freezes a complete staged release before any cross-transaction proof read. */
const beginProgram = Effect.fn("contentRelease.beginVerify")(function* (
  ctx: MutationCtx,
  releaseId: string
) {
  const { release } = yield* loadStaged(ctx, releaseId);
  if (release.status === "verifying" || release.status === "verified") {
    return release.checkedIndex;
  }
  const signed = yield* decodeReleaseJson(release.releaseJson);
  const complete =
    release.status === "staging" &&
    release.abortingAt === undefined &&
    release.stagedItems === signed.manifest.itemCount &&
    release.stagedDeletes === signed.manifest.deleteCount &&
    release.stagedUpserts === signed.manifest.upsertCount &&
    release.stagedArtifacts === signed.manifest.upsertCount &&
    release.stagedProjections === signed.manifest.projectionCount &&
    release.stagedRoutes === signed.manifest.routeCount;
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
});

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
      .take(RELEASE_PAGE_LIMIT + 1)
  );
  const page = rows.slice(0, RELEASE_PAGE_LIMIT);
  for (const [offset, row] of page.entries()) {
    const expectedIndex = release.checkedItems + offset;
    if (row.index !== expectedIndex) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Content release ${releaseId} expected item ${expectedIndex}, received ${row.index}.`
      );
    }
    yield* checkItem(ctx, row);
  }
  const processed = page.length;
  const checkedItems = release.checkedItems + processed;
  const nextIndex = page.at(-1)?.index ?? release.checkedIndex;
  const done = rows.length <= RELEASE_PAGE_LIMIT;
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

/** Atomically freezes staging so the verifier reads a quiescent candidate. */
export const begin = internalMutation({
  args: { releaseId: v.string() },
  returns: v.number(),
  handler: (ctx, args) => runConvexProgram(beginProgram(ctx, args.releaseId)),
});

/** Verifies one bounded item page and returns a durable continuation index. */
export const verifyItems = internalMutation({
  args: { afterIndex: v.number(), releaseId: v.string() },
  returns: progressValidator,
  handler: (ctx, args) =>
    runConvexProgram(verifyProgram(ctx, args.releaseId, args.afterIndex)),
});
