import { FunctionSpec, GroupSpec } from "@confect/core";
import type { deliverWelcomeEmail } from "@repo/backend/confect/emails/welcome/workflow";
export default GroupSpec.make().addFunction(
  FunctionSpec.convexInternalMutation<typeof deliverWelcomeEmail>()(
    "deliverWelcomeEmail"
  )
);
