import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { Operation, Outcome } from "@repo/backend/confect/island/operation";
import { Access, Closed, Sticker } from "@repo/backend/confect/island/schema";
import { Short, Thing } from "@repo/backend/confect/island/things";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";

/** The most operations one change sends (ADR 0050, W4). */
export const CHANGE_BATCH = 64;

export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "open",
      args: () => ({ timeZone: Schema.TimeZoneNamedFromString }),
      returns: () => Schema.Struct({ entered: Schema.NullOr(Schema.Finite) }),
      error: () => AuthFailure,
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "change",
      args: () => ({
        ops: Schema.Array(Operation).check(Schema.isMaxLength(CHANGE_BATCH)),
      }),
      returns: () => Schema.Array(Outcome),
      error: () => AuthFailure,
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "unlock",
      args: () => ({ kind: Thing }),
      returns: () =>
        Schema.Struct({
          balance: Schema.Finite,
          blueprints: Schema.Array(Thing),
        }),
      error: () => Schema.Union([AuthFailure, Short]),
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "share",
      args: () => ({ access: Access }),
      returns: () => Schema.Null,
      error: () => AuthFailure,
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "greet",
      args: () => ({ sticker: Sticker, username: Schema.String }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AuthFailure, Closed]),
    })
      .middleware(Session)
      .middleware(Atomic)
  );
