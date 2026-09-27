import { FunctionSpec, GroupSpec } from "@confect/core";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "cleanupRetainedEmailData",
    args: () => ({}),
    returns: () => Schema.Null,
  }).middleware(Atomic)
);
