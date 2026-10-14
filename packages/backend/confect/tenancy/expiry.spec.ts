import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/**
 * Marks one invite expired when its term ends. Scheduled once, at the moment the
 * invite stores as its expiry, so no query reads the clock.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "invite",
    args: () => ({ inviteId: Id("tenantInvites") }),
    returns: () => Schema.Null,
  })
);
