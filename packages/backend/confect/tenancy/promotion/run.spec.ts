import { FunctionSpec, GroupSpec } from "@confect/core";
import { Id } from "@repo/backend/confect/_generated/id";
import { Schema } from "effect";

/**
 * Runs the next page or step of applying or undoing a promotion, then schedules
 * the run after it. Scheduled by the promotion's own functions, never by a client.
 */
export default GroupSpec.make().addFunction(
  FunctionSpec.internalMutation({
    name: "run",
    args: () => ({
      actorId: Id("tenantPeople"),
      promotionId: Id("tenantPromotions"),
    }),
    returns: () => Schema.Null,
  })
);
