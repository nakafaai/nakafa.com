import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { reconcileModel } from "@repo/backend/convex/contentRelease/models/reconcile";
import schema from "@repo/backend/convex/schema";
import { stream } from "convex-helpers/server/stream";
import { Effect } from "effect";

/** Reconciles article catalogs and partitions through their native indexes. */
export const reconcileArticleModel = Effect.fn(
  "contentRelease.reconcileArticleModel"
)(function* (ctx: MutationCtx, build: Doc<"contentModelBuilds">) {
  const sourceSlot = build.slots.articleBaseSlot;
  const targetSlot = build.slots.articleTargetSlot;
  if (build.phase === "articleCatalog") {
    const query = stream(ctx.db, schema).query("articleCatalog");
    return yield* reconcileModel({
      build,
      source: query.withIndex("by_slot_and_contentKey_and_appLocale", (index) =>
        index.eq("slot", sourceSlot)
      ),
      target: query.withIndex("by_slot_and_contentKey_and_appLocale", (index) =>
        index.eq("slot", targetSlot)
      ),
      sourceSlot,
      targetSlot,
      indexFields: ["contentKey", "appLocale"],
      position: (row) => [row.contentKey, row.appLocale],
      insert: ({ _creationTime, _id, ...fields }) =>
        Effect.promise(() =>
          ctx.db.insert("articleCatalog", { ...fields, slot: targetSlot })
        ).pipe(Effect.asVoid),
      replace: (target, { _creationTime, _id, ...fields }) =>
        Effect.promise(() =>
          ctx.db.replace("articleCatalog", target._id, {
            ...fields,
            slot: targetSlot,
          })
        ),
      remove: (target) =>
        Effect.promise(() => ctx.db.delete("articleCatalog", target._id)),
    });
  }
  if (build.phase === "articleCategories") {
    const query = stream(ctx.db, schema).query("articleCategories");
    return yield* reconcileModel({
      build,
      source: query.withIndex("by_slot_and_appLocale_and_category", (index) =>
        index.eq("slot", sourceSlot)
      ),
      target: query.withIndex("by_slot_and_appLocale_and_category", (index) =>
        index.eq("slot", targetSlot)
      ),
      sourceSlot,
      targetSlot,
      indexFields: ["appLocale", "category"],
      position: (row) => [row.appLocale, row.category],
      insert: ({ _creationTime, _id, ...fields }) =>
        Effect.promise(() =>
          ctx.db.insert("articleCategories", { ...fields, slot: targetSlot })
        ).pipe(Effect.asVoid),
      replace: (target, { _creationTime, _id, ...fields }) =>
        Effect.promise(() =>
          ctx.db.replace("articleCategories", target._id, {
            ...fields,
            slot: targetSlot,
          })
        ),
      remove: (target) =>
        Effect.promise(() => ctx.db.delete("articleCategories", target._id)),
    });
  }
  const query = stream(ctx.db, schema).query("articleBuckets");
  return yield* reconcileModel({
    build,
    source: query.withIndex("by_slot_and_appLocale_and_bucket", (index) =>
      index.eq("slot", sourceSlot)
    ),
    target: query.withIndex("by_slot_and_appLocale_and_bucket", (index) =>
      index.eq("slot", targetSlot)
    ),
    sourceSlot,
    targetSlot,
    indexFields: ["appLocale", "bucket"],
    position: (row) => [row.appLocale, row.bucket],
    insert: ({ _creationTime, _id, ...fields }) =>
      Effect.promise(() =>
        ctx.db.insert("articleBuckets", { ...fields, slot: targetSlot })
      ).pipe(Effect.asVoid),
    replace: (target, { _creationTime, _id, ...fields }) =>
      Effect.promise(() =>
        ctx.db.replace("articleBuckets", target._id, {
          ...fields,
          slot: targetSlot,
        })
      ),
    remove: (target) =>
      Effect.promise(() => ctx.db.delete("articleBuckets", target._id)),
  });
});
