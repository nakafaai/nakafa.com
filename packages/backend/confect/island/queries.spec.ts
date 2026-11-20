import { FunctionSpec, GroupSpec } from "@confect/core";
import {
  Growth,
  Leader,
  Medals,
  OwnIsland,
  SetClaims,
  Week,
} from "@repo/backend/confect/island/view";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  TryoutRouteErrorWire,
  tryoutSetIdentityValidator,
} from "@repo/backend/confect/tryouts/route";
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
      name: "growth",
      args: () => ({}),
      returns: () => Schema.NullOr(Growth),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "week",
      args: () => ({}),
      returns: () => Schema.NullOr(Week),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "leaders",
      args: () => ({}),
      returns: () => Schema.Array(Leader),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "claims",
      args: () => tryoutSetIdentityValidator.fields,
      returns: () => Schema.NullOr(SetClaims),
      error: () => TryoutRouteErrorWire,
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "medals",
      args: () => ({ username: Schema.String }),
      returns: () => Schema.NullOr(Medals),
    }).middleware(Session)
  );
