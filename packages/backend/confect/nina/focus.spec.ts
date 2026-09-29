import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { NinaFocusSourceSchema } from "@repo/backend/confect/nina/contract/focus";
import { Schema } from "effect";

/** Generation reads a turn's focused question after rechecking its entitlement. */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalQuery({
    name: "read",
    args: () => ({ turnId: Id("ninaTurns") }),
    returns: () => Schema.NullOr(NinaFocusSourceSchema),
  })
);
