import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { verifyEffectiveMaterial } from "@repo/backend/convex/contentRelease/material/verify";
import {
  MODEL_BUILD_PAGE_BYTES,
  MODEL_BUILD_PAGE_ROWS,
  type ModelBuildPage,
} from "@repo/backend/convex/contentRelease/models/spec";
import { Effect } from "effect";

/** Validates one bounded inactive material page against candidate heads. */
export const validateMaterialModel = Effect.fn(
  "contentRelease.validateMaterialModel"
)(function* (ctx: MutationCtx, build: Doc<"contentModelBuilds">) {
  const page = yield* Effect.promise(() =>
    ctx.db
      .query("materialCatalog")
      .withIndex("by_slot_and_contentKey_and_appLocale", (index) =>
        index.eq("slot", build.slots.materialTargetSlot)
      )
      .paginate({
        cursor: build.cursor ?? null,
        maximumBytesRead: MODEL_BUILD_PAGE_BYTES,
        maximumRowsRead: MODEL_BUILD_PAGE_ROWS,
        numItems: MODEL_BUILD_PAGE_ROWS,
      })
  );
  yield* Effect.forEach(page.page, (row) =>
    verifyEffectiveMaterial(ctx, row, build.sequence)
  );
  return {
    cursor: page.isDone ? undefined : page.continueCursor,
    done: page.isDone,
    processed: page.page.length,
  } satisfies ModelBuildPage;
});
