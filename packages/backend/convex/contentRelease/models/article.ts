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

/** Clears one bounded inactive article table page. */
export const clearArticleModel = Effect.fn("contentRelease.clearArticleModel")(
  function* (ctx: MutationCtx, build: ModelBuild) {
    const slot = build.slots.articleTargetSlot;
    if (build.phase === "articleClearCatalog") {
      const rows = yield* Effect.promise(() =>
        ctx.db
          .query("articleCatalog")
          .withIndex("by_slot_and_contentKey_and_appLocale", (index) =>
            index.eq("slot", slot)
          )
          .take(MODEL_BUILD_PAGE_ROWS)
      );
      for (const row of rows) {
        yield* Effect.promise(() => ctx.db.delete("articleCatalog", row._id));
      }
      return clearResult(rows.length);
    }
    if (build.phase === "articleClearCategories") {
      const rows = yield* Effect.promise(() =>
        ctx.db
          .query("articleCategories")
          .withIndex("by_slot_and_appLocale_and_category", (index) =>
            index.eq("slot", slot)
          )
          .take(MODEL_BUILD_PAGE_ROWS)
      );
      for (const row of rows) {
        yield* Effect.promise(() =>
          ctx.db.delete("articleCategories", row._id)
        );
      }
      return clearResult(rows.length);
    }
    const rows = yield* Effect.promise(() =>
      ctx.db
        .query("articleBuckets")
        .withIndex("by_slot_and_appLocale_and_bucket", (index) =>
          index.eq("slot", slot)
        )
        .take(MODEL_BUILD_PAGE_ROWS)
    );
    for (const row of rows) {
      yield* Effect.promise(() => ctx.db.delete("articleBuckets", row._id));
    }
    return clearResult(rows.length);
  }
);

/** Copies one bounded active article table page into its inactive buffer. */
export const copyArticleModel = Effect.fn("contentRelease.copyArticleModel")(
  function* (ctx: MutationCtx, build: ModelBuild) {
    const source = build.slots.articleBaseSlot;
    const target = build.slots.articleTargetSlot;
    const options = pageOptions(build.cursor);
    if (build.phase === "articleCopyCatalog") {
      const page = yield* Effect.promise(() =>
        ctx.db
          .query("articleCatalog")
          .withIndex("by_slot_and_contentKey_and_appLocale", (index) =>
            index.eq("slot", source)
          )
          .paginate(options)
      );
      for (const row of page.page) {
        const { _creationTime, _id, ...fields } = row;
        yield* Effect.promise(() =>
          ctx.db.insert("articleCatalog", { ...fields, slot: target })
        );
      }
      return {
        cursor: page.isDone ? undefined : page.continueCursor,
        done: page.isDone,
        processed: page.page.length,
      } satisfies ModelBuildPage;
    }
    if (build.phase === "articleCopyCategories") {
      const page = yield* Effect.promise(() =>
        ctx.db
          .query("articleCategories")
          .withIndex("by_slot_and_appLocale_and_category", (index) =>
            index.eq("slot", source)
          )
          .paginate(options)
      );
      for (const row of page.page) {
        const { _creationTime, _id, ...fields } = row;
        yield* Effect.promise(() =>
          ctx.db.insert("articleCategories", { ...fields, slot: target })
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
        .query("articleBuckets")
        .withIndex("by_slot_and_appLocale_and_bucket", (index) =>
          index.eq("slot", source)
        )
        .paginate(options)
    );
    for (const row of page.page) {
      const { _creationTime, _id, ...fields } = row;
      yield* Effect.promise(() =>
        ctx.db.insert("articleBuckets", { ...fields, slot: target })
      );
    }
    return {
      cursor: page.isDone ? undefined : page.continueCursor,
      done: page.isDone,
      processed: page.page.length,
    } satisfies ModelBuildPage;
  }
);
