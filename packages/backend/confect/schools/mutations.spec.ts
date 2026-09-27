import { FunctionSpec, GroupSpec } from "@confect/core";
import { AuthFailure } from "@repo/backend/confect/auth/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import Session from "@repo/backend/confect/middleware/session.spec";
import {
  SchoolCreateError,
  SchoolReadError,
} from "@repo/backend/confect/schools/errors";
import { InvitationError } from "@repo/backend/confect/schools/invitations/spec";
import { schoolTypeValidator } from "@repo/backend/confect/schools/schema";
import { schoolIdentityResultValidator } from "@repo/backend/confect/schools/validators";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.publicMutation({
      name: "createSchool",
      args: () => ({
        name: Schema.String,
        email: Schema.String,
        phone: Schema.String,
        address: Schema.String,
        city: Schema.String,
        province: Schema.String,
        type: schoolTypeValidator,
      }),
      returns: () => schoolIdentityResultValidator,
      error: () => Schema.Union([AuthFailure, SchoolCreateError]),
    })
      .middleware(Session)
      .middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "joinSchool",
      args: () => ({
        code: Schema.String,
      }),
      returns: () => schoolIdentityResultValidator,
      error: () =>
        Schema.Union([AuthFailure, InvitationError, SchoolReadError]),
    })
      .middleware(Session)
      .middleware(Atomic)
  );
