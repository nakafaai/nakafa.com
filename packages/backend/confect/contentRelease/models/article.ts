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
          .table("articleCatalog")
          .insert({
            ...fields,
            slot: targetSlot,
          })
          .pipe(Effect.orDie, Effect.asVoid),
      replace: (target, { _creationTime, _id, ...fields }) =>
        writer
          .table("articleCatalog")
          .replace(target._id, {
            ...fields,
            slot: targetSlot,
          })
          .pipe(Effect.orDie),
      remove: (target) => writer.table("articleCatalog").delete(target._id),
    });
  }
  if (build.phase === "articleCategories") {
    const query = (yield* DatabaseReader).table("articleCategories");
    return yield* reconcileModel({
      build,
      source: query.stream("by_slot_and_appLocale_and_category", (index) =>
        index.eq("slot", sourceSlot)
      ),
      target: query.stream("by_slot_and_appLocale_and_category", (index) =>
        index.eq("slot", targetSlot)
      ),
      sourceSlot,
      targetSlot,
      position: (row) => [row.appLocale, row.category],
      insert: ({ _creationTime, _id, ...fields }) =>
        writer
          .table("articleCategories")
          .insert({
            ...fields,
            slot: targetSlot,
          })
          .pipe(Effect.orDie, Effect.asVoid),
      replace: (target, { _creationTime, _id, ...fields }) =>
        writer
          .table("articleCategories")
          .replace(target._id, {
            ...fields,
            slot: targetSlot,
          })
          .pipe(Effect.orDie),
      remove: (target) => writer.table("articleCategories").delete(target._id),
    });
  }
  const query = (yield* DatabaseReader).table("articleBuckets");
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
        .table("articleBuckets")
        .insert({
          ...fields,
          slot: targetSlot,
        })
        .pipe(Effect.orDie, Effect.asVoid),
    replace: (target, { _creationTime, _id, ...fields }) =>
      writer
        .table("articleBuckets")
        .replace(target._id, {
          ...fields,
          slot: targetSlot,
        })
        .pipe(Effect.orDie),
    remove: (target) => writer.table("articleBuckets").delete(target._id),
  });
});
