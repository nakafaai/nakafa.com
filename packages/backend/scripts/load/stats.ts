import {
  Array as Arr,
  Number as Num,
  Option,
  Order,
  pipe,
  Record,
  Schema,
} from "effect";

/** The spread of one measure of one kind of call, such as its latency in milliseconds or the documents it read. */
export const Spread = Schema.Struct({
  count: Schema.Int,
  failed: Schema.Int,
  max: Schema.Finite,
  p50: Schema.Finite,
  p95: Schema.Finite,
  p99: Schema.Finite,
});
export type Spread = typeof Spread.Type;

/** One measured call: its name, the value measured, such as milliseconds or documents, and whether it failed. */
export const Sample = Schema.Struct({
  failed: Schema.Boolean,
  value: Schema.Finite,
  name: Schema.String,
});
export type Sample = typeof Sample.Type;

/**
 * The value at a percentile of sorted samples, by the nearest-rank method: the smallest
 * sample that at least `percent` of the samples are at or under. No sample gives zero.
 */
export const percentile = (sorted: readonly number[], percent: number) =>
  pipe(
    Arr.get(
      sorted,
      Num.clamp(Math.ceil((percent / 100) * sorted.length) - 1, {
        maximum: sorted.length - 1,
        minimum: 0,
      })
    ),
    Option.getOrElse(() => 0)
  );

/**
 * The spread of one kind of call from its samples. The percentiles read every sample, a
 * failed call included, because a student waits for a refusal as long as for a success.
 */
export const spreadOf = (samples: readonly Sample[]): Spread => {
  const sorted = Arr.sort(
    Arr.map(samples, (sample) => sample.value),
    Order.Number
  );
  return {
    count: sorted.length,
    failed: Arr.filter(samples, (sample) => sample.failed).length,
    max: Option.getOrElse(Arr.last(sorted), () => 0),
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
};

/** The spread of every kind of call that the samples name, by its name. */
export const spreadByName = (samples: readonly Sample[]) =>
  Record.map(
    Arr.groupBy(samples, (sample) => sample.name),
    spreadOf
  );
