import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

export default GroupSpec.makeNode().addFunction(
  FunctionSpec.internalNodeAction({
    name: "run",
    args: () => ({ turnId: Id("ninaTurns") }),
    returns: () => Schema.Null,
  })
);
