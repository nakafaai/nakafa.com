import { FunctionSpec, GroupSpec } from "@confect/core";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  Growth,
  Leader,
  Medals,
  SetClaims,
  Week,
} from "@repo/backend/confect/progress/view";
import {
  TryoutRouteErrorWire,
  tryoutSetIdentityValidator,
} from "@repo/backend/confect/tryouts/route";
import { Schema } from "effect";

export default GroupSpec.make()
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
