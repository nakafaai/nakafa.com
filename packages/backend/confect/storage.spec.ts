import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

export const storageSweepArgs = Schema.Struct({
  continuation: Schema.optionalKey(
    Schema.Struct({
      before: Schema.Finite,
      cursor: Schema.String,
    })
  ),
});

export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "sweep",
    args: () => storageSweepArgs.fields,
    returns: () =>
      Schema.Struct({
        deleted: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
        done: Schema.Boolean,
        scanned: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
      }),
  })
);
