import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { reconcileModel } from "@repo/backend/confect/contentRelease/models/reconcile";
import { Effect } from "effect";

/** Reconciles article catalogs and partitions through their native indexes. */
export const reconcileArticleModel = Effect.fn(
  "contentRelease.reconcileArticleModel"
)(function* (build: Docs["contentModelBuilds"]) {
  const writer = yield* DatabaseWriter;
  const sourceSlot = build.slots.articleBaseSlot;
  const targetSlot = build.slots.articleTargetSlot;
  if (build.phase === "articleCatalog") {
    const query = (yield* DatabaseReader).table("articleCatalog");
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
          .table("articleCatalog")
          .insert({
            ...fields,
            slot: targetSlot,
          })
          .pipe(Effect.orDie, Effect.asVoid),
      (target, { _creationTime, _id, ...fields }) =>
        writer
          .table("articleCatalog")
          .replace(target._id, {
            ...fields,
            slot: targetSlot,
          })
          .pipe(Effect.orDie),
      (target) => writer.table("articleCatalog").delete(target._id)
    );
  }
  if (build.phase === "articleCategories") {
    const query = (yield* DatabaseReader).table("articleCategories");
    return yield* reconcileModel(
      { build, sourceSlot, targetSlot },
      query.stream("by_slot_and_appLocale_and_category", (index) =>
        index.eq("slot", sourceSlot)
      ),
      query.stream("by_slot_and_appLocale_and_category", (index) =>
        index.eq("slot", targetSlot)
      ),
      (row) => [row.appLocale, row.category],
      ({ _creationTime, _id, ...fields }) =>
        writer
          .table("articleCategories")
          .insert({
            ...fields,
            slot: targetSlot,
          })
          .pipe(Effect.orDie, Effect.asVoid),
      (target, { _creationTime, _id, ...fields }) =>
        writer
          .table("articleCategories")
          .replace(target._id, {
            ...fields,
            slot: targetSlot,
          })
          .pipe(Effect.orDie),
      (target) => writer.table("articleCategories").delete(target._id)
    );
  }
  const query = (yield* DatabaseReader).table("articleBuckets");
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
        .table("articleBuckets")
        .insert({
          ...fields,
          slot: targetSlot,
        })
        .pipe(Effect.orDie, Effect.asVoid),
    (target, { _creationTime, _id, ...fields }) =>
      writer
        .table("articleBuckets")
        .replace(target._id, {
          ...fields,
          slot: targetSlot,
        })
        .pipe(Effect.orDie),
    (target) => writer.table("articleBuckets").delete(target._id)
  );
});
