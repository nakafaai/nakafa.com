import { FunctionSpec, GroupSpec } from "@confect/core";
import { Schema } from "effect";

export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "sweep",
    args: () => ({}),
    returns: () =>
      Schema.Struct({
        deleted: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
        done: Schema.Boolean,
        scanned: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
      }),
  })
);
