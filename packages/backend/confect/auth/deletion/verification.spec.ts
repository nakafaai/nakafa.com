import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { UserCleanupErrorWire } from "@repo/backend/confect/auth/cleanup/spec";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalQuery({
      name: "loadDeletedUserVerificationCursor",
      args: () => ({
        userId: IdSchema("users"),
      }),
      returns: () => Schema.Union([Schema.Null, Schema.String]),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "saveDeletedUserVerificationCursor",
      args: () => ({
        cursor: Schema.Union([Schema.Null, Schema.String]),
        userId: IdSchema("users"),
      }),
      returns: () => Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "drainDeletedUserVerifications",
      args: () => ({
        authId: Schema.String,
        userId: IdSchema("users"),
      }),
      returns: () => Schema.Null,
      error: () => UserCleanupErrorWire,
    })
  );
