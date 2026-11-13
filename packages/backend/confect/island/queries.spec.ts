import { FunctionSpec, GroupSpec } from "@confect/core";
import { OwnIsland } from "@repo/backend/confect/island/view";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";
export default GroupSpec.make().addFunction(
  FunctionSpec.publicQuery({
    name: "own",
    args: () => ({}),
    returns: () => Schema.NullOr(OwnIsland),
  }).middleware(Session)
);
