import { FunctionSpec, GroupSpec } from "@confect/core";
import { Region } from "@repo/backend/confect/island/chunk";
import {
  Growth,
  Changed,
  Guest,
  Leader,
  Medals,
  OwnIsland,
  SetClaims,
  Visit,
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
      name: "region",
      args: () => ({
        rx: Region,
        rz: Region,
        username: Schema.NullOr(Schema.String),
      }),
      returns: () => Schema.Array(Changed),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "visit",
      args: () => ({ username: Schema.String }),
      returns: () => Schema.NullOr(Visit),
    }).middleware(Session)
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "guests",
      args: () => ({}),
      returns: () => Schema.Array(Guest),
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
