import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { NinaUsage } from "@repo/backend/confect/nina/contract/usage";
import { Schema } from "effect";

export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "record",
    args: () => ({ turnId: Id("ninaTurns"), usage: NinaUsage }),
    returns: () => Schema.Null,
  })
);
