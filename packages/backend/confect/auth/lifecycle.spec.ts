import { FunctionSpec, GroupSpec } from "@confect/core";
import type {
  onCreate,
  onDelete,
  onUpdate,
} from "@repo/backend/confect/auth/lifecycle";
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof onCreate>()("onCreate")
  )
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof onUpdate>()("onUpdate")
  )
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof onDelete>()("onDelete")
  );
