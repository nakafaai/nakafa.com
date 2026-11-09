import { FunctionSpec, GroupSpec } from "@confect/core";
import {
  OwnIsland,
  VisitedIsland,
  Week,
} from "@repo/backend/confect/island/view";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicQuery({
      name: "own",
      args: () => ({}),
      returns: () => Schema.NullOr(OwnIsland),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "visit",
      args: () => ({ username: Schema.String }),
      returns: () => Schema.NullOr(VisitedIsland),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "week",
      args: () => ({}),
      returns: () => Schema.NullOr(Week),
    }).middleware(Session)
  );
