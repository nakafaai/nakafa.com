import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/** A run asks whether it has any reason to go on: its turn was stopped, settled, or removed. */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalQuery({
    name: "halted",
    args: () => ({ turnId: Id("ninaTurns") }),
    returns: () => Schema.Boolean,
  })
);
