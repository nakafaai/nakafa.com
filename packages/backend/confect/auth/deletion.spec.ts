import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { Schema } from "effect";

/** The signed-in person deletes their own account (`deletion/request`). */
export default GroupSpec.make().addFunction(
  FunctionSpec.publicMutation({
    name: "deleteAccount",
    returns: () => Schema.Null,
    error: () => AuthFailure,
  })
    .middleware(Session)
    .middleware(Atomic)
);
