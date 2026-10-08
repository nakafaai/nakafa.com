import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { reconcileModel } from "@repo/backend/confect/contentRelease/models/reconcile";
import { Effect } from "effect";

/** Reconciles material catalogs and partitions through their native indexes. */
export const reconcileMaterialModel = Effect.fn(
  "contentRelease.reconcileMaterialModel"
)(function* (build: Docs["contentModelBuilds"]) {
  const writer = yield* DatabaseWriter;
  const sourceSlot = build.slots.materialBaseSlot;
  const targetSlot = build.slots.materialTargetSlot;
  if (build.phase === "materialCatalog") {
    const query = (yield* DatabaseReader).table("materialCatalog");
    return yield* reconcileModel(
      { build, sourceSlot, targetSlot },
      query.stream("by_slot_and_contentKey_and_appLocale", (index) =>
        index.eq("slot", sourceSlot)
      ),
      query.stream("by_slot_and_contentKey_and_appLocale", (index) =>
        index.eq("slot", targetSlot)
      ),
      (row) => [row.contentKey, row.appLocale],
      ({ _creationTime, _id, ...fields }) =>
        writer
          .table("materialCatalog")
          .insert({
            ...fields,
            slot: targetSlot,
          })
          .pipe(Effect.orDie, Effect.asVoid),
      (target, { _creationTime, _id, ...fields }) =>
        writer
          .table("materialCatalog")
          .replace(target._id, {
            ...fields,
            slot: targetSlot,
          })
          .pipe(Effect.orDie),
      (target) => writer.table("materialCatalog").delete(target._id)
    );
  }
  const query = (yield* DatabaseReader).table("materialBuckets");
  return yield* reconcileModel(
    { build, sourceSlot, targetSlot },
    query.stream("by_slot_and_appLocale_and_bucket", (index) =>
      index.eq("slot", sourceSlot)
    ),
    query.stream("by_slot_and_appLocale_and_bucket", (index) =>
      index.eq("slot", targetSlot)
    ),
    (row) => [row.appLocale, row.bucket],
    ({ _creationTime, _id, ...fields }) =>
      writer
        .table("materialBuckets")
        .insert({
          ...fields,
          slot: targetSlot,
        })
        .pipe(Effect.orDie, Effect.asVoid),
    (target, { _creationTime, _id, ...fields }) =>
      writer
        .table("materialBuckets")
        .replace(target._id, {
          ...fields,
          slot: targetSlot,
        })
        .pipe(Effect.orDie),
    (target) => writer.table("materialBuckets").delete(target._id)
  );
});
