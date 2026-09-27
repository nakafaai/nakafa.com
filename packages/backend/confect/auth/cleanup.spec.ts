import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { UserCleanupErrorWire } from "@repo/backend/confect/auth/cleanup/spec";
import { ForumAttachmentIoErrorWire } from "@repo/backend/confect/classes/forums/attachments/spec";
import { ForumCleanupError } from "@repo/backend/confect/classes/forums/spec";
import { ReleaseError } from "@repo/backend/confect/contentRelease/error";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { TryoutRuntimeErrorWire } from "@repo/backend/confect/tryouts/runtime/error";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "cleanupDeletedUser",
      args: () => ({
        userId: IdSchema("users"),
      }),
      returns: () => Schema.Boolean,
      error: () =>
        Schema.Union([
          UserCleanupErrorWire,
          TryoutRuntimeErrorWire,
          ReleaseError,
          ForumAttachmentIoErrorWire,
          ForumCleanupError,
        ]),
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalAction({
      name: "drainDeletedUserData",
      args: () => ({
        userId: IdSchema("users"),
      }),
      returns: () => Schema.Null,
      error: () => UserCleanupErrorWire,
    })
  );
