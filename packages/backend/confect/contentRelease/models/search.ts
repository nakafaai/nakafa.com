import { DatabaseReader, DatabaseWriter } from "@confect/server";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { reconcileModel } from "@repo/backend/confect/contentRelease/models/reconcile";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

/** Reconciles search slots through their native content and locale ordering. */
export const reconcileSearchModel = Effect.fn(
  "contentRelease.reconcileSearchModel"
)(function* (ctx: MutationCtx, build: Doc<"contentModelBuilds">) {
  const writer = DatabaseWriter.make(databaseSchema, ctx.db);
  const sourceSlot = build.slots.searchBaseSlot;
  const targetSlot = build.slots.searchTargetSlot;
  const query = DatabaseReader.make(databaseSchema, ctx.db).table(
    "contentIndex"
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
        .table("contentIndex")
        .insert({
          ...fields,
          slot: targetSlot,
        })
        .pipe(Effect.orDie, Effect.asVoid),
    replace: (target, { _creationTime, _id, ...fields }) =>
      writer
        .table("contentIndex")
        .replace(target._id, {
          ...fields,
          slot: targetSlot,
        })
        .pipe(Effect.orDie),
    remove: (target) => writer.table("contentIndex").delete(target._id),
  });
});
