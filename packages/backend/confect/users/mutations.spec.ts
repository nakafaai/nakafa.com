import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import { BioTooLong } from "@repo/backend/confect/users/bio";
import { UserPicture } from "@repo/backend/confect/users/picture";
import { selfSelectableUserRoleValidator } from "@repo/backend/confect/users/schema";
import { UsernameRejected } from "@repo/backend/confect/users/username";
import { MascotCode } from "@repo/mascot/code";
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
      name: "updateUsername",
      args: () => ({
        username: Schema.String,
      }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AuthFailure, UsernameRejected]),
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "updateBio",
      args: () => ({
        bio: Schema.String,
      }),
      returns: () => Schema.Null,
      error: () => Schema.Union([AuthFailure, BioTooLong]),
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "setMascot",
      args: () => ({
        mascot: MascotCode,
      }),
      returns: () => Schema.Struct({ mascot: MascotCode }),
      error: () => AuthFailure,
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "setPicture",
      args: () => ({
        picture: UserPicture,
      }),
      returns: () => Schema.Null,
      error: () => AuthFailure,
    })
      .middleware(Session)
      .middleware(Atomic)
  );
