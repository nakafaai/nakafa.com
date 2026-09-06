import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { reconcileModel } from "@repo/backend/convex/contentRelease/models/reconcile";
import schema from "@repo/backend/convex/schema";
import { stream } from "convex-helpers/server/stream";
import { Effect } from "effect";

/** Reconciles material catalogs and partitions through their native indexes. */
export const reconcileMaterialModel = Effect.fn(
  "contentRelease.reconcileMaterialModel"
)(function* (ctx: MutationCtx, build: Doc<"contentModelBuilds">) {
  const sourceSlot = build.slots.materialBaseSlot;
  const targetSlot = build.slots.materialTargetSlot;
  if (build.phase === "materialCatalog") {
    const query = stream(ctx.db, schema).query("materialCatalog");
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
          ctx.db.insert("materialCatalog", { ...fields, slot: targetSlot })
        ).pipe(Effect.asVoid),
      replace: (target, { _creationTime, _id, ...fields }) =>
        Effect.promise(() =>
          ctx.db.replace("materialCatalog", target._id, {
            ...fields,
            slot: targetSlot,
          })
        ),
      remove: (target) =>
        Effect.promise(() => ctx.db.delete("materialCatalog", target._id)),
    });
  }
  const query = stream(ctx.db, schema).query("materialBuckets");
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
        ctx.db.insert("materialBuckets", { ...fields, slot: targetSlot })
      ).pipe(Effect.asVoid),
    replace: (target, { _creationTime, _id, ...fields }) =>
      Effect.promise(() =>
        ctx.db.replace("materialBuckets", target._id, {
          ...fields,
          slot: targetSlot,
        })
      ),
    remove: (target) =>
      Effect.promise(() => ctx.db.delete("materialBuckets", target._id)),
  });
});
