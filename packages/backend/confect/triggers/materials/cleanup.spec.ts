import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id as IdSchema } from "@repo/backend/confect/_generated/id";
import Atomic from "@repo/backend/confect/middleware/atomic.spec";
import { Schema } from "effect";
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "cleanupDeletedGroup",
    args: () => ({
      classId: IdSchema("schoolClasses"),
      groupId: IdSchema("schoolClassMaterialGroups"),
    }),
    returns: () => Schema.Null,
  }).middleware(Atomic)
);
