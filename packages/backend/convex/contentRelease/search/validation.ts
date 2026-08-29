import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  MODEL_BUILD_PAGE_BYTES,
  MODEL_BUILD_PAGE_ROWS,
  type ModelBuildPage,
} from "@repo/backend/convex/contentRelease/models/spec";
import { resolveSearchProjection } from "@repo/backend/convex/contentRelease/search/verify";
import { Effect } from "effect";

/** Validates one bounded inactive search page against candidate heads. */
export const validateSearchModel = Effect.fn(
  "contentRelease.validateSearchModel"
)(function* (
  ctx: MutationCtx,
  build: Doc<"contentModelBuilds">,
  release: Doc<"contentReleases">
) {
  const page = yield* Effect.promise(() =>
    ctx.db
      .query("contentIndex")
      .withIndex("by_slot_and_contentKey_and_appLocale", (index) =>
        index.eq("slot", build.slots.searchTargetSlot)
      )
      .paginate({
        cursor: build.cursor ?? null,
        maximumBytesRead: MODEL_BUILD_PAGE_BYTES,
        maximumRowsRead: MODEL_BUILD_PAGE_ROWS,
        numItems: MODEL_BUILD_PAGE_ROWS,
      })
  );
  const owner = {
    families: release.resultFamilies,
    manifestHash: build.manifestHash,
    releaseId: build.releaseId,
    sequence: build.sequence,
    slot: build.slots.searchTargetSlot,
  };
  yield* Effect.forEach(page.page, (row) =>
    resolveSearchProjection(ctx, row, owner)
  );
  return {
    cursor: page.isDone ? undefined : page.continueCursor,
    done: page.isDone,
    processed: page.page.length,
  } satisfies ModelBuildPage;
});
