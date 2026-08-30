import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  MODEL_BUILD_PAGE_BYTES,
  MODEL_BUILD_PAGE_ROWS,
  type ModelBuildPage,
} from "@repo/backend/convex/contentRelease/models/spec";
import { Effect } from "effect";

type ModelBuild = Doc<"contentModelBuilds">;

function clearResult(processed: number): ModelBuildPage {
  return { done: processed < MODEL_BUILD_PAGE_ROWS, processed };
}

function pageOptions(cursor: string | undefined) {
  return {
    cursor: cursor ?? null,
    maximumBytesRead: MODEL_BUILD_PAGE_BYTES,
    maximumRowsRead: MODEL_BUILD_PAGE_ROWS,
    numItems: MODEL_BUILD_PAGE_ROWS,
  };
}

/** Clears one bounded inactive material table page. */
export const clearMaterialModel = Effect.fn(
  "contentRelease.clearMaterialModel"
)(function* (ctx: MutationCtx, build: ModelBuild) {
  const slot = build.slots.materialTargetSlot;
  if (build.phase === "materialClearCatalog") {
    const rows = yield* Effect.promise(() =>
      ctx.db
        .query("materialCatalog")
        .withIndex("by_slot_and_contentKey_and_appLocale", (index) =>
          index.eq("slot", slot)
        )
        .take(MODEL_BUILD_PAGE_ROWS)
    );
    for (const row of rows) {
      yield* Effect.promise(() => ctx.db.delete("materialCatalog", row._id));
    }
    return clearResult(rows.length);
  }
  const rows = yield* Effect.promise(() =>
    ctx.db
      .query("materialBuckets")
      .withIndex("by_slot_and_appLocale_and_bucket", (index) =>
        index.eq("slot", slot)
      )
      .take(MODEL_BUILD_PAGE_ROWS)
  );
  for (const row of rows) {
    yield* Effect.promise(() => ctx.db.delete("materialBuckets", row._id));
  }
  return clearResult(rows.length);
});

/** Copies one bounded active material table page into its inactive buffer. */
export const copyMaterialModel = Effect.fn("contentRelease.copyMaterialModel")(
  function* (ctx: MutationCtx, build: ModelBuild) {
    const source = build.slots.materialBaseSlot;
    const target = build.slots.materialTargetSlot;
    const options = pageOptions(build.cursor);
    if (build.phase === "materialCopyCatalog") {
      const page = yield* Effect.promise(() =>
        ctx.db
          .query("materialCatalog")
          .withIndex("by_slot_and_contentKey_and_appLocale", (index) =>
            index.eq("slot", source)
          )
          .paginate(options)
      );
      for (const row of page.page) {
        const { _creationTime, _id, ...fields } = row;
        yield* Effect.promise(() =>
          ctx.db.insert("materialCatalog", { ...fields, slot: target })
        );
      }
      return {
        cursor: page.isDone ? undefined : page.continueCursor,
        done: page.isDone,
        processed: page.page.length,
      } satisfies ModelBuildPage;
    }
    const page = yield* Effect.promise(() =>
      ctx.db
        .query("materialBuckets")
        .withIndex("by_slot_and_appLocale_and_bucket", (index) =>
          index.eq("slot", source)
        )
        .paginate(options)
    );
    for (const row of page.page) {
      const { _creationTime, _id, ...fields } = row;
      yield* Effect.promise(() =>
        ctx.db.insert("materialBuckets", { ...fields, slot: target })
      );
    }
    return {
      cursor: page.isDone ? undefined : page.continueCursor,
      done: page.isDone,
      processed: page.page.length,
    } satisfies ModelBuildPage;
  }
);
