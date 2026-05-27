import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import type { ConvexQueryCtx } from "@repo/backend/confect/modules/shared/convexContext";
import { IrtError } from "@repo/backend/confect/modules/tryout/irt.errors";
import { Effect } from "effect";

/** Loads the newest scale version for one tryout. */
export const getLatestScaleVersionForTryout = Effect.fn(
  "irt.scales.read.getLatestScaleVersionForTryout"
)(function* (db: ConvexQueryCtx["db"], tryoutId: Id<"tryouts">) {
  return yield* Effect.promise(() =>
    db
      .query("irtScaleVersions")
      .withIndex("by_tryoutId_and_publishedAt", (query) =>
        query.eq("tryoutId", tryoutId)
      )
      .order("desc")
      .first()
  );
});

/** Loads all frozen scale items for a scale version. */
export const getScaleVersionItems = Effect.fn(
  "irt.scales.read.getScaleVersionItems"
)(function* (db: ConvexQueryCtx["db"], scaleVersion: Doc<"irtScaleVersions">) {
  const scaleItems = yield* Effect.promise(() =>
    db
      .query("irtScaleVersionItems")
      .withIndex("by_scaleVersionId_and_setId_and_questionId", (query) =>
        query.eq("scaleVersionId", scaleVersion._id)
      )
      .take(scaleVersion.questionCount + 1)
  );

  if (scaleItems.length <= scaleVersion.questionCount) {
    return scaleItems;
  }

  return yield* Effect.fail(
    new IrtError({
      code: "IRT_SCALE_ITEM_COUNT_EXCEEDED",
      message:
        "Frozen scale item count exceeds the scale version question count.",
    })
  );
});

/** Loads scale items for one scale version and exercise set. */
export const getScaleVersionItemsForSet = Effect.fn(
  "irt.scales.read.getScaleVersionItemsForSet"
)(function* (
  db: ConvexQueryCtx["db"],
  args: {
    readonly questionCount: number;
    readonly scaleVersionId: Id<"irtScaleVersions">;
    readonly setId: Id<"exerciseSets">;
  }
) {
  const scaleItems = yield* Effect.promise(() =>
    db
      .query("irtScaleVersionItems")
      .withIndex("by_scaleVersionId_and_setId_and_questionId", (query) =>
        query.eq("scaleVersionId", args.scaleVersionId).eq("setId", args.setId)
      )
      .take(args.questionCount + 1)
  );

  if (scaleItems.length <= args.questionCount) {
    return scaleItems;
  }

  return yield* Effect.fail(
    new IrtError({
      code: "IRT_SCALE_ITEM_COUNT_EXCEEDED",
      message: "Frozen scale item count exceeds the set question count.",
    })
  );
});
