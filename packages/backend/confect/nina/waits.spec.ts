import { FunctionSpec, GroupSpec } from "@confect/core";
import { NinaTurnTiming } from "@repo/backend/confect/nina/contract/turn";
import { Schema, Struct } from "effect";

/**
 * The most turns one report reads. A run at the maximum reads 500 documents, of
 * the 32,000 that one query may scan. On the turns that `waits.impl.test.ts`
 * builds it read 728,000 bytes, about 4 percent of the 16 MiB it may read
 * (https://docs.convex.dev/production/state/limits): the transaction's own
 * metrics for one database query over copies of one turn of 1,456 bytes, settled
 * by the lifecycle with its page context, three usage rows and four waits. The
 * test pins the 500 documents and that the bytes stay under a tenth of the 16
 * MiB. It does not pin the 728,000, which moves with the text of its fixture.
 * Turns on production were not measured and may weigh more.
 */
const NINA_WAITS_MAX = 500;

/** How many of the newest turns one report reads: a whole number from 1 to the maximum. */
const NinaWaitsCount = Schema.Int.check(
  Schema.isBetween({ maximum: NINA_WAITS_MAX, minimum: 1 })
);

/** A number of turns, never below zero. */
const Count = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

/**
 * The spread of one stage over the read turns that hold its wait, in
 * milliseconds after the admission. A turn that ended early holds only the
 * stages it reached, so `turns` can be fewer than the turns read. `min`,
 * `median`, `p90` and `max` are the smallest, median, 90th percentile and
 * largest wait, and are absent when no read turn holds the wait.
 */
const NinaWaitSpread = Schema.Struct({
  stage: Schema.Literals(Struct.keys(NinaTurnTiming.fields)),
  turns: Count,
  min: Schema.optionalKey(Schema.Finite),
  median: Schema.optionalKey(Schema.Finite),
  p90: Schema.optionalKey(Schema.Finite),
  max: Schema.optionalKey(Schema.Finite),
});

/**
 * What the newest turns say about how long learners waited, as numbers only.
 * `oldest` and `newest` are the creation times of the oldest and newest turn
 * read, absent when none was read. `statuses` counts the read turns by how they
 * stand: `open` while queued or running, otherwise the status they settled with.
 */
const NinaWaitsSummary = Schema.Struct({
  read: Count,
  oldest: Schema.optionalKey(Schema.Finite),
  newest: Schema.optionalKey(Schema.Finite),
  statuses: Schema.Struct({
    cancelled: Count,
    complete: Count,
    failed: Count,
    open: Count,
  }),
  waits: Schema.Array(NinaWaitSpread),
});

/**
 * Reports how long learners waited at each stage of their newest turns. Run it
 * with `convex run nina/waits:summary '{"count": 500}'` on the development
 * deployment, and add `--prod` after the arguments to run it on production. It
 * reads the newest `count` turns in one indexed read, so a run is bounded by
 * `NINA_WAITS_MAX`, and it returns counts and milliseconds only: no learner,
 * chat, turn or text.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalQuery({
    name: "summary",
    args: () => ({ count: NinaWaitsCount }),
    returns: () => NinaWaitsSummary,
  })
);
