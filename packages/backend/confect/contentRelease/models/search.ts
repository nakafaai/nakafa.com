import type { Docs } from "@repo/backend/confect/_generated/docs";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { reconcileModel } from "@repo/backend/confect/contentRelease/models/reconcile";
import { Effect } from "effect";

/** Reconciles search slots through their native content and locale ordering. */
export const reconcileSearchModel = Effect.fn(
  "contentRelease.reconcileSearchModel"
)(function* (build: Docs["contentModelBuilds"]) {
  const writer = yield* DatabaseWriter;
  const sourceSlot = build.slots.searchBaseSlot;
  const targetSlot = build.slots.searchTargetSlot;
  const query = (yield* DatabaseReader).table("contentIndex");
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
        .table("contentIndex")
        .insert({
          ...fields,
          slot: targetSlot,
        })
        .pipe(Effect.orDie, Effect.asVoid),
    (target, { _creationTime, _id, ...fields }) =>
      writer
        .table("contentIndex")
        .replace(target._id, {
          ...fields,
          slot: targetSlot,
        })
        .pipe(Effect.orDie),
    (target) => writer.table("contentIndex").delete(target._id)
  );
});
