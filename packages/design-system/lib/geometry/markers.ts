import { Effect, Schema } from "effect";

/** Selected authored samples whose point markers remain visible on a dense curve. */
export const LineMarkerIndicesSchema = Schema.Array(
  Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
).check(
  Schema.makeFilter((indices) => new Set(indices).size === indices.length, {
    message: "Expected each point marker index only once.",
  })
);
export type LineMarkerIndices = typeof LineMarkerIndicesSchema.Type;

/** A curve marker selection does not identify real authored samples. */
export class LineMarkerError extends Schema.TaggedError<LineMarkerError>()(
  "LineMarkerError",
  { message: Schema.String }
) {}

/** Selects exact existing point objects without a second coordinate source. */
export const resolveLineMarkers = Effect.fn("line.resolveMarkers")(function* <
  Point,
>(points: readonly Point[], indices?: LineMarkerIndices) {
  if (indices === undefined) {
    return points;
  }
  const selected = yield* Schema.decodeEffect(LineMarkerIndicesSchema)(
    indices
  ).pipe(
    Effect.mapError((error) => new LineMarkerError({ message: error.message }))
  );
  if (selected.some((index) => index >= points.length)) {
    return yield* new LineMarkerError({
      message:
        "Expected every point marker index to identify an existing curve sample.",
    });
  }
  return selected.map((index) => points[index]);
});
