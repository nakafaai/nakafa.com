import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

/** What one page of a sweep did: the rows it deleted, the rows it read, and whether it read the table to its end. */
const SweepResult = Schema.Struct({
  deleted: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  done: Schema.Boolean,
  scanned: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

/**
 * The sweep of the step log. It is internal: the cron starts it, and it starts itself
 * again with the cursor of the next page until the log is read. It deletes the steps a
 * snapshot covers. A session record has no sweep: it stays until its document is
 * deleted, because a client that was away may still need it (ADR 0028).
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "sweep",
    args: () => ({ cursor: Schema.NullOr(Schema.String) }),
    returns: () => SweepResult,
  })
);
