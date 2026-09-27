import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import { CreditStateError } from "@repo/backend/confect/credits/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  selfSelectableUserRoleValidator,
  userRoleValidator,
} from "@repo/backend/confect/users/schema";
import { Schema } from "effect";
/**
 * Update the app user's role.
 */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateUserRole",
      args: () => ({
        role: selfSelectableUserRoleValidator,
      }),
      returns: () => Schema.Null,
      error: () => AuthFailure,
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateUserName",
      args: () => ({
        name: Schema.String,
      }),
      returns: () => Schema.Null,
      error: () => AuthFailure,
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "syncUserInfoForChat",
      args: () => ({}),
      returns: () =>
        Schema.Struct({
          role: Schema.NullOr(userRoleValidator),
          credits: Schema.Finite,
          userId: IdSchema("users"),
        }),
      error: () => Schema.Union([AuthFailure, CreditStateError]),
    })
      .middleware(Session)
      .middleware(Atomic)
  );
