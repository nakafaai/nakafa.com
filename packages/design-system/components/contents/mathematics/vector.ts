import { Effect, Array as EffectArray, Schema } from "effect";

const VectorPointSchema = Schema.Struct({
  x: Schema.Finite,
  y: Schema.Finite,
});

/** One directed vector path in authored coordinate order. */
export const VectorGeometrySchema = Schema.Struct({
  direction: Schema.optional(
    Schema.Literals(["forward", "backward", "both", "none"])
  ),
  points: Schema.NonEmptyArray(VectorPointSchema),
});

/** An authored vector cannot be represented by finite geometric coordinates. */
export class VectorError extends Schema.TaggedError<VectorError>()(
  "VectorError",
  { message: Schema.String }
) {}

/** Preserves authored point order and attaches the label to the directed tip. */
export const resolveVectorGeometry = Effect.fn("Vector.resolve")(function* (
  input: unknown
) {
  const vector = yield* Schema.decodeUnknownEffect(VectorGeometrySchema)(
    input
  ).pipe(
    Effect.mapError((error) => new VectorError({ message: error.message }))
  );
  const first = vector.points[0];
  const last = EffectArray.lastNonEmpty(vector.points);
  const direction = vector.direction ?? "forward";
  return {
    direction,
    points: vector.points,
    tail: direction === "backward" ? last : first,
    tip: direction === "backward" ? first : last,
  };
});
