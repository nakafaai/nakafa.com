import { FunctionSpec, GroupSpec } from "@confect/core";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";

/** What one call of the strip pass did, and whether it has read every comment. */
const StripResult = Schema.Struct({
  done: Schema.Boolean,
  scanned: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  stripped: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  votesRemoved: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

/**
 * One-off strip pass for the fields that the likes replaced. It removes `upvoteCount`,
 * `downvoteCount` and `replyToText` from every comment that still holds one of them,
 * and deletes every row of `commentVotes`.
 *
 * Each call first deletes at most 50 vote rows, in creation order. When it deleted any,
 * it schedules itself with the same cursor and returns. Otherwise it reads one page of
 * 50 comments in creation order, after `cursor` (absent for the first page), and
 * replaces each comment that holds one of the three fields with a row that holds none
 * of them (`stripped`). `scanned` counts the comments that the call read, and `done` is
 * true on the last page. Any other page schedules the next page with its cursor.
 *
 * A second run strips nothing and removes no vote, so it reports zero for both. The
 * orchestrator runs this internal function on dev and then on production, with
 * `convex run comments/migration:run '{}'` and then `--prod`, until `done` is true. The
 * change that deletes this function, the three fields and the `commentVotes` table
 * follows those runs.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "run",
    args: () => ({
      cursor: Schema.optionalKey(Schema.String),
    }),
    returns: () => StripResult,
  }).middleware(Atomic)
);
