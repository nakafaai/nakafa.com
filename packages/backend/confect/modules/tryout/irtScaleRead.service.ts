import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { IrtError } from "@repo/backend/confect/modules/tryout/irt.errors";
import { Effect, Option } from "effect";

/** Loads the newest scale version for one tryout. */
export const getLatestScaleVersionForTryout = Effect.fnUntraced(function* (
  tryoutId: Id<"tryouts">
) {
  const reader = yield* DatabaseReader;
  return yield* reader
    .table("irtScaleVersions")
    .index(
      "by_tryoutId_and_publishedAt",
      (query) => query.eq("tryoutId", tryoutId),
      "desc"
    )
    .first()
    .pipe(Effect.map(Option.getOrNull));
});

/** Loads all frozen scale items for a scale version. */
export const getScaleVersionItems = Effect.fnUntraced(function* (
  scaleVersion: Doc<"irtScaleVersions">
) {
  const reader = yield* DatabaseReader;
  const scaleItems = yield* reader
    .table("irtScaleVersionItems")
    .index("by_scaleVersionId_and_setId_and_questionId", (query) =>
      query.eq("scaleVersionId", scaleVersion._id)
    )
    .take(scaleVersion.questionCount + 1);

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
export const getScaleVersionItemsForSet = Effect.fnUntraced(function* (args: {
  readonly questionCount: number;
  readonly scaleVersionId: Id<"irtScaleVersions">;
  readonly setId: Id<"exerciseSets">;
}) {
  const reader = yield* DatabaseReader;
  const scaleItems = yield* reader
    .table("irtScaleVersionItems")
    .index("by_scaleVersionId_and_setId_and_questionId", (query) =>
      query.eq("scaleVersionId", args.scaleVersionId).eq("setId", args.setId)
    )
    .take(args.questionCount + 1);

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
