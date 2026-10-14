import { FunctionSpec, GroupSpec } from "@confect/core";
import type { finishInviteEmail } from "@repo/backend/confect/emails/invite/completion";
import type { deliverInviteEmail } from "@repo/backend/confect/emails/invite/workflow";

/** The durable delivery of one invitation email, and the handler that releases its journal. */
export default GroupSpec.make()
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof deliverInviteEmail>()(
      "deliverInviteEmail"
    )
  )
  .addFunction(
    FunctionSpec.convexInternalMutation<typeof finishInviteEmail>()(
      "finishInviteEmail"
    )
  );
