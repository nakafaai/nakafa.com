import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  MODEL_BUILD_PAGE_BYTES,
  MODEL_BUILD_PAGE_ROWS,
  type ModelBuildPage,
} from "@repo/backend/convex/contentRelease/models/spec";
import { Effect } from "effect";

type ModelBuild = Doc<"contentModelBuilds">;

/** Clears one bounded inactive search page. */
export const clearSearchModel = Effect.fn("contentRelease.clearSearchModel")(
  function* (ctx: MutationCtx, build: ModelBuild) {
    const rows = yield* Effect.promise(() =>
      ctx.db
        .query("contentIndex")
        .withIndex("by_slot_and_contentKey_and_appLocale", (index) =>
          index.eq("slot", build.slots.searchTargetSlot)
        )
        .take(MODEL_BUILD_PAGE_ROWS)
    );
    for (const row of rows) {
      yield* Effect.promise(() => ctx.db.delete("contentIndex", row._id));
    }
    return {
      done: rows.length < MODEL_BUILD_PAGE_ROWS,
      processed: rows.length,
    } satisfies ModelBuildPage;
  }
);

/** Copies one bounded active search page into its inactive buffer. */
export const copySearchModel = Effect.fn("contentRelease.copySearchModel")(
  function* (ctx: MutationCtx, build: ModelBuild) {
    const page = yield* Effect.promise(() =>
      ctx.db
        .query("contentIndex")
        .withIndex("by_slot_and_contentKey_and_appLocale", (index) =>
          index.eq("slot", build.slots.searchBaseSlot)
        )
        .paginate({
          cursor: build.cursor ?? null,
          maximumBytesRead: MODEL_BUILD_PAGE_BYTES,
          maximumRowsRead: MODEL_BUILD_PAGE_ROWS,
          numItems: MODEL_BUILD_PAGE_ROWS,
        })
    );
    for (const row of page.page) {
      const { _creationTime, _id, ...fields } = row;
      yield* Effect.promise(() =>
        ctx.db.insert("contentIndex", {
          ...fields,
          slot: build.slots.searchTargetSlot,
        })
      );
    }
    return {
      cursor: page.isDone ? undefined : page.continueCursor,
      done: page.isDone,
      processed: page.page.length,
    } satisfies ModelBuildPage;
  }
);
