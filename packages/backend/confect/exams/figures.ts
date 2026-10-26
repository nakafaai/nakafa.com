import type { GenericId } from "@confect/core";
import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import { AccessDenied } from "@repo/backend/confect/access/errors";
import type { PlacedQuestion } from "@repo/backend/confect/exams/import";
import { Effect, Option } from "effect";

/**
 * The images of an exam that imported figures name, each with its alternative text and its size,
 * in the order the figures come. An image of another exam, or one that no longer exists, is
 * refused as a missing object, so no question shows another school's file.
 */
export const figureImages = Effect.fn("exams.figures.images")(function* (
  examId: GenericId.GenericId<"exams">,
  figures: PlacedQuestion["figures"]
) {
  const reader = yield* DatabaseReader;
  return yield* Effect.forEach(figures, (figure) =>
    Effect.gen(function* () {
      const asset = yield* reader
        .table("examAssets")
        .get(figure.asset)
        .pipe(Effect.option);
      if (Option.isNone(asset) || asset.value.examId !== examId) {
        return yield* new AccessDenied({
          action: "exam.edit",
          reason: "resource",
        });
      }
      return {
        alt: figure.alt,
        asset: asset.value._id,
        height: asset.value.height,
        width: asset.value.width,
      };
    })
  );
});
