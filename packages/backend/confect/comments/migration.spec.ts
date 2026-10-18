import { FunctionSpec, GroupSpec } from "@confect/core";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";

/** The counts of one page of the migration, in the same shape for both passes. */
export const MigrationCounts = Schema.Struct({
  likesAdded: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  linked: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  orphaned: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  recounted: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  votesRemoved: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

/** What one call of the migration did, and whether it read the table to its end. */
const MigrationResult = Schema.Struct({
  ...MigrationCounts.fields,
  done: Schema.Boolean,
  scanned: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

/**
 * One-off migration for the comment thread model and the likes that replace votes.
 *
 * Without `recount`, one call reads one page of 50 comments in creation order, after
 * `cursor` (absent for the first page). Creation order puts a parent before its
 * replies. For each comment on the page it sets:
 * - `threadId`, from the top-level comment of its parent chain. A top-level comment
 *   has none. A parent that is gone makes the comment top-level, so its `parentId` is
 *   cleared (`orphaned`).
 * - the likes, converted from its votes: an up vote becomes a like unless the learner
 *   already liked the comment, and every vote row is deleted (`votesRemoved`).
 * - `likeCount`, which is the count of likes before the conversion plus the likes the
 *   conversion added. A comment that has no count yet gets one here.
 *
 * With `recount: true`, the call reads the same pages and sets the `replyCount` of
 * each top-level comment to the size of its thread (`recounted`). Each thread is read
 * in one read, which Convex allows only once per call, so the page is not split.
 *
 * Both passes are idempotent: a second run of a pass writes nothing. When a page is
 * not the last, the call schedules itself with the cursor of the next page, and each
 * page logs its counts.
 *
 * The orchestrator runs this internal function on production with `convex run` after
 * the deploy: first the pass without `recount` until `done` is true, then the pass
 * with `recount: true` from the first page. The change that deletes this function,
 * its implementation and its tests follows those two runs on production.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "run",
    args: () => ({
      cursor: Schema.optionalKey(Schema.String),
      recount: Schema.optionalKey(Schema.Boolean),
    }),
    returns: () => MigrationResult,
  }).middleware(Atomic)
);
