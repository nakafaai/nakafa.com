import { FunctionSpec, GroupSpec } from "@confect/core";
import type { verifyRelease } from "@repo/backend/confect/contentRelease/proof/workflow";
export default GroupSpec.make().addFunction(
  FunctionSpec.convexInternalMutation<typeof verifyRelease>()("verifyRelease")
);
