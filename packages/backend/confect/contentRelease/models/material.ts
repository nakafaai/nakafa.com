import { DatabaseReader, DatabaseWriter } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { reconcileModel } from "@repo/backend/confect/contentRelease/models/reconcile";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

/** Reconciles material catalogs and partitions through their native indexes. */
export const reconcileMaterialModel = Effect.fn(
  "contentRelease.reconcileMaterialModel"
)(function* (ctx: MutationCtx, build: Doc<"contentModelBuilds">) {
  const writer = DatabaseWriter.make(databaseSchema, ctx.db);
  const sourceSlot = build.slots.materialBaseSlot;
  const targetSlot = build.slots.materialTargetSlot;
  if (build.phase === "materialCatalog") {
    const query = DatabaseReader.make(databaseSchema, ctx.db).table(
      "materialCatalog"
    );
    return yield* reconcileModel({
      build,
      source: query.stream("by_slot_and_contentKey_and_appLocale", (index) =>
        index.eq("slot", sourceSlot)
      ),
      target: query.stream("by_slot_and_contentKey_and_appLocale", (index) =>
        index.eq("slot", targetSlot)
      ),
      sourceSlot,
      targetSlot,
      position: (row) => [row.contentKey, row.appLocale],
      insert: ({ _creationTime, _id, ...fields }) =>
        writer
          .table("materialCatalog")
          .insert({
            ...fields,
            slot: targetSlot,
          })
          .pipe(Effect.orDie, Effect.asVoid),
      replace: (target, { _creationTime, _id, ...fields }) =>
        writer
          .table("materialCatalog")
          .replace(target._id, {
            ...fields,
            slot: targetSlot,
          })
          .pipe(Effect.orDie),
      remove: (target) => writer.table("materialCatalog").delete(target._id),
    });
  }
  const query = DatabaseReader.make(databaseSchema, ctx.db).table(
    "materialBuckets"
  );
  return yield* reconcileModel({
    build,
    source: query.stream("by_slot_and_appLocale_and_bucket", (index) =>
      index.eq("slot", sourceSlot)
    ),
    target: query.stream("by_slot_and_appLocale_and_bucket", (index) =>
      index.eq("slot", targetSlot)
    ),
    sourceSlot,
    targetSlot,
    position: (row) => [row.appLocale, row.bucket],
    insert: ({ _creationTime, _id, ...fields }) =>
      writer
        .table("materialBuckets")
        .insert({
          ...fields,
          slot: targetSlot,
        })
        .pipe(Effect.orDie, Effect.asVoid),
    replace: (target, { _creationTime, _id, ...fields }) =>
      writer
        .table("materialBuckets")
        .replace(target._id, {
          ...fields,
          slot: targetSlot,
        })
        .pipe(Effect.orDie),
    remove: (target) => writer.table("materialBuckets").delete(target._id),
  });
});
