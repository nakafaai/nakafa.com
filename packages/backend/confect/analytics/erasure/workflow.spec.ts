import { FunctionSpec, GroupSpec } from "@confect/core";
import type { eraseConsentOverlap } from "@repo/backend/confect/analytics/erasure/workflow";
export default GroupSpec.make().addFunction(
  FunctionSpec.convexInternalMutation<typeof eraseConsentOverlap>()(
    "eraseConsentOverlap"
  )
);
