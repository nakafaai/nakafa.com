import { Effect, Schema } from "effect";

/** A real exponential model and the integer observations shown beside it. */
export const ExponentialSchema = Schema.Struct({
  a: Schema.Finite.check(Schema.isGreaterThan(0)),
  mode: Schema.optional(Schema.Literals(["continuous", "discrete"])),
  n: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(2))),
  p: Schema.Finite,
});
export type Exponential = typeof ExponentialSchema.Type;

/** The model cannot produce finite values for its chart. */
export class ExponentialError extends Schema.TaggedError<ExponentialError>()(
  "ExponentialError",
  { message: Schema.String }
) {}

const SAMPLES_PER_INTERVAL = 32;

/** Samples the actual model and retains its integer observations separately. */
export const resolveExponential = Effect.fn("Exponential.resolve")(function* (
  input: Exponential
) {
  const {
    a,
    p,
    n = 11,
    mode = "continuous",
  } = yield* Schema.decodeEffect(ExponentialSchema)(input).pipe(
    Effect.mapError((error) => new ExponentialError({ message: error.message }))
  );
  const values = Array.from({ length: n }, (_, x) => ({ x, y: p * a ** x }));
  if (values.some(({ y }) => !Number.isFinite(y))) {
    return yield* new ExponentialError({
      message: "The exponential model exceeds finite chart values.",
    });
  }
  const divisions = (n - 1) * SAMPLES_PER_INTERVAL;
  const curve =
    mode === "discrete"
      ? []
      : Array.from({ length: divisions + 1 }, (_, index) => {
          const x = index / SAMPLES_PER_INTERVAL;
          return { x, y: p * a ** x };
        });
  return { curve, values };
});
