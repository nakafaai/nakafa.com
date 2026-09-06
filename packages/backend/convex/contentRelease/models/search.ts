import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { reconcileModel } from "@repo/backend/convex/contentRelease/models/reconcile";
import schema from "@repo/backend/convex/schema";
import { stream } from "convex-helpers/server/stream";
import { Effect } from "effect";

/** Reconciles search slots through their native content and locale ordering. */
export const reconcileSearchModel = Effect.fn(
  "contentRelease.reconcileSearchModel"
)(function* (ctx: MutationCtx, build: Doc<"contentModelBuilds">) {
  const sourceSlot = build.slots.searchBaseSlot;
  const targetSlot = build.slots.searchTargetSlot;
  const query = stream(ctx.db, schema).query("contentIndex");
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
        ctx.db.insert("contentIndex", { ...fields, slot: targetSlot })
      ).pipe(Effect.asVoid),
    replace: (target, { _creationTime, _id, ...fields }) =>
      Effect.promise(() =>
        ctx.db.replace("contentIndex", target._id, {
          ...fields,
          slot: targetSlot,
        })
      ),
    remove: (target) =>
      Effect.promise(() => ctx.db.delete("contentIndex", target._id)),
  });
});
