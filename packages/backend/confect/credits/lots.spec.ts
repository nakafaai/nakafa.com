import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";

/** The scheduled ends of top-up packs: a pack that reaches its expiry writes its last credit change. */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "expire",
    args: () => ({
      lotId: IdSchema("creditLots"),
    }),
    returns: () => Schema.Null,
  }).middleware(Atomic)
);
