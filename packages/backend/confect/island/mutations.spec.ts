import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { Visibility } from "@repo/backend/confect/island/schema";
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
  );
