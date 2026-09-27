import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { ForumCleanupErrorWire } from "@repo/backend/confect/classes/forums/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "cleanupDeletedClass",
      args: () => ({
        classId: IdSchema("schoolClasses"),
      }),
      returns: () => Schema.Null,
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "cleanupDeletedForum",
      args: () => ({
        forumId: IdSchema("schoolClassForums"),
      }),
      returns: () => Schema.Null,
      error: () => ForumCleanupErrorWire,
    }).middleware(Atomic)
  );
