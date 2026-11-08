import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { BuildRefused, Operation } from "@repo/backend/confect/island/build";
import { IslandStale, Visibility } from "@repo/backend/confect/island/schema";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "open",
      args: () => ({ timeZone: Schema.TimeZoneNamedFromString }),
      returns: () => Schema.Null,
      error: () => AuthFailure,
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "share",
      args: () => ({ visibility: Visibility }),
      returns: () => Schema.Null,
      error: () => AuthFailure,
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "edit",
      args: () => ({
        operations: Schema.Array(Operation).check(Schema.isMaxLength(64)),
        version: Schema.Int,
      }),
      returns: () => Schema.Struct({ version: Schema.Int }),
      error: () => Schema.Union([AuthFailure, BuildRefused, IslandStale]),
    })
      .middleware(Session)
      .middleware(Atomic)
  );
