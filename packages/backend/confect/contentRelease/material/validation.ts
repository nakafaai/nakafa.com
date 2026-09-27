import { DatabaseReader } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import {
  MODEL_BUILD_PAGE_BYTES,
  MODEL_BUILD_PAGE_ROWS,
  type ModelBuildPage,
} from "@repo/backend/confect/contentRelease/models/spec";
import { verifyEffectiveMaterial } from "@repo/backend/content/material/verify";
import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

/** Validates one bounded inactive material page against candidate heads. */
export const validateMaterialModel = Effect.fn(
  "contentRelease.validateMaterialModel"
)(function* (ctx: MutationCtx, build: Doc<"contentModelBuilds">) {
  const database = DatabaseReader.make(databaseSchema, ctx.db);
  const page = yield* database
    .table("materialCatalog")
    .index("by_slot_and_contentKey_and_appLocale", (index) =>
      index.eq("slot", build.slots.materialTargetSlot)
    )
    .paginate({
      cursor: build.cursor ?? null,
      maximumBytesRead: MODEL_BUILD_PAGE_BYTES,
      maximumRowsRead: MODEL_BUILD_PAGE_ROWS,
      numItems: MODEL_BUILD_PAGE_ROWS,
    })
    .pipe(Effect.orDie);
  yield* Effect.forEach(page.page, (row) =>
    verifyEffectiveMaterial(row, build.sequence).pipe(
      Effect.provide(convexPublicationLayer(ctx))
    )
  );
  return {
    cursor: page.isDone ? undefined : page.continueCursor,
    done: page.isDone,
    processed: page.page.length,
  } satisfies ModelBuildPage;
});
