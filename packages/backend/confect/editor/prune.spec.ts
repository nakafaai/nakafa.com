import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

/** What one page of a sweep did: the rows it deleted, the rows it read, and whether it read the table to its end. */
const SweepResult = Schema.Struct({
  deleted: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  done: Schema.Boolean,
  scanned: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

/**
 * The sweeps of the editor's rows. They are internal: the crons start them, and each
 * one starts itself again with the cursor of the next page until its table is read.
 * `sweep` deletes the steps a snapshot covers, and `sweepClients` deletes the
 * editor-session records a snapshot covers.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "sweep",
      args: () => ({ cursor: Schema.NullOr(Schema.String) }),
      returns: () => SweepResult,
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "sweepClients",
      args: () => ({ cursor: Schema.NullOr(Schema.String) }),
      returns: () => SweepResult,
    })
  );
