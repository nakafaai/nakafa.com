import { DAY, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "@repo/backend/confect/_generated/components";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { StorageFull } from "@repo/backend/confect/bucket/errors";
import { Effect, Number as Num, Option, Schema } from "effect";

/**
 * The most bytes the whole bucket holds, every school counted, held under the 10 GB-month that R2 stores free
 * (https://developers.cloudflare.com/r2/pricing/), so the bucket never bills storage. Each school's own limit is
 * checked beside it.
 */
export const BUCKET_BYTE_LIMIT = 8_000_000_000;

/** How many bytes the whole bucket holds and has reserved for uploads under way. */
export const bucketUseValidator = Schema.Struct({
  bytes: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

/**
 * The R2 operations the server signs each day, every school counted. R2 gives 1 million writes (Class A) and 10
 * million reads (Class B) a month free, so 30,000 writes and 300,000 reads a day stay inside both in a month of
 * 31 days. An address the server refuses to sign costs nothing.
 */
const operations = new RateLimiter(components.agentRateLimiter, {
  bucketRead: { kind: "fixed window", period: DAY, rate: 300_000, shards: 8 },
  bucketWrite: { kind: "fixed window", period: DAY, rate: 30_000, shards: 4 },
});

/** Spends some of the day's free operations of one class, and refuses once they are spent. */
export const spendOperations = Effect.fn("bucket.spend")(function* (
  kind: "bucketRead" | "bucketWrite",
  count: number
) {
  const ctx = yield* MutationCtx;
  const status = yield* Effect.tryPromise(() =>
    operations.limit(ctx, kind, { count })
  ).pipe(Effect.orDie);
  if (!status.ok) {
    return yield* new StorageFull({ reason: "operations" });
  }
});

/** The one row of the bucket's use, when anything was ever stored. */
const useRow = Effect.fn("bucket.use.read")(function* () {
  return yield* (yield* DatabaseReader)
    .table("bucketUse")
    .index("by_creation_time")
    .first()
    .pipe(Effect.orDie);
});

/** Adds bytes to the bucket's use, and refuses, adding nothing, when they pass its limit. */
export const chargeBucket = Effect.fn("bucket.use.charge")(function* (
  bytes: number
) {
  const use = yield* useRow();
  const held = Option.match(use, {
    onNone: () => 0,
    onSome: (row) => row.bytes,
  });
  if (held + bytes > BUCKET_BYTE_LIMIT) {
    return yield* new StorageFull({ reason: "bucket" });
  }
  const writer = (yield* DatabaseWriter).table("bucketUse");
  if (Option.isNone(use)) {
    yield* writer.insert({ bytes }).pipe(Effect.orDie);
    return;
  }
  yield* writer
    .patch(use.value._id, { bytes: held + bytes })
    .pipe(Effect.orDie);
});

/** Takes bytes off the bucket's use once their object is gone or its upload failed. */
export const refundBucket = Effect.fn("bucket.use.refund")(function* (
  bytes: number
) {
  const use = yield* useRow();
  if (Option.isNone(use)) {
    return;
  }
  yield* (yield* DatabaseWriter)
    .table("bucketUse")
    .patch(use.value._id, { bytes: Num.max(use.value.bytes - bytes, 0) })
    .pipe(Effect.orDie);
});
