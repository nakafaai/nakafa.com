import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

/**
 * What one page of the clearing did: the unkeyed fingerprints it cleared from settled
 * turns, the active turns on the page that still hold one (it leaves them alone), the
 * turns it read, and whether it read the table to its end.
 */
const ClearResult = Schema.Struct({
  activeOld: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  cleared: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  done: Schema.Boolean,
  scanned: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

/**
 * One-off maintenance for the request fingerprint that `turns.start` stored before the
 * keyed fingerprint (ADR 0024, Decision 5). That value is an unkeyed SHA-256 in lower-case
 * hexadecimal, 64 characters, which a reader of the database could use to confirm a
 * guessed request.
 *
 * One call reads one page of `ninaTurns` in creation order, after `cursor` (absent for
 * the first page). On that page it removes the fingerprint from each settled turn that
 * holds the unkeyed value, unless `dryRun` is set: a dry run writes nothing and only
 * counts. It never writes an active turn. An active turn must keep a fingerprint
 * (`turns.spec.ts`), so the call counts it in `activeOld` and leaves it alone. When the
 * page is not the last, the call schedules itself with the cursor of the next page. Each
 * page logs its counts.
 *
 * The operator runs it with `convex run` on production: once after the deploy, and again
 * after the longest turn has settled (`TURN_DEADLINE`, `confect/nina/deadline.ts`). The
 * second run must show `activeOld` 0 on every page: then no active turn holds the unkeyed
 * value, and every settled one was cleared. The change that deletes this function, its
 * implementation and its tests follows that second run.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "clear",
    args: () => ({
      cursor: Schema.optionalKey(Schema.String),
      dryRun: Schema.Boolean,
    }),
    returns: () => ClearResult,
  })
);
