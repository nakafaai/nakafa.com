import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { UserCleanupErrorWire } from "@repo/backend/confect/auth/cleanup/spec";
import { accountDeletionPreparationVersionValidator } from "@repo/backend/confect/auth/deletion/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "finalizeDeletedUserCleanup",
      args: () => ({
        authId: Schema.String,
        expectedPreparation: Schema.optionalKey(
          accountDeletionPreparationVersionValidator
        ),
      }),
      returns: () => Schema.Null,
      error: () => UserCleanupErrorWire,
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "launchDeletedUserCleanup",
      args: () => ({
        authId: Schema.String,
        userId: IdSchema("users"),
      }),
      returns: () => Schema.Null,
      error: () => UserCleanupErrorWire,
    }).middleware(Atomic)
  );
