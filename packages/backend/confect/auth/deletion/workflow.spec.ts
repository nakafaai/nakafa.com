import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import { UserCleanupErrorWire } from "@repo/backend/confect/auth/cleanup/spec";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";

/** The scheduled steps that finish a deleted account (`deletion/finalize`, `deletion/workflow`). */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.internalMutation({
      name: "finalize",
      args: () => ({ userId: IdSchema("users") }),
      returns: () => Schema.Null,
      error: () => UserCleanupErrorWire,
    }).middleware(Atomic)
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "launch",
      args: () => ({ userId: IdSchema("users") }),
      returns: () => Schema.Null,
      error: () => UserCleanupErrorWire,
    }).middleware(Atomic)
  );
