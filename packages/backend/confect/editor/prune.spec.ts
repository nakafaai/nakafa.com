import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

/**
 * The sweep of the step log. It is internal: the cron starts it, and it starts
 * itself again with the cursor of the next page until the log is read.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "sweep",
    args: () => ({ cursor: Schema.NullOr(Schema.String) }),
    returns: () =>
      Schema.Struct({
        deleted: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
        done: Schema.Boolean,
        scanned: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
      }),
  })
);
