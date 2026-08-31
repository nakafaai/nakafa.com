import { internalMutation } from "@repo/backend/convex/_generated/server";
import { captureProductEvent } from "@repo/backend/convex/analytics/capture";
import { admitCheckoutProgram } from "@repo/backend/convex/customers/checkout/impl";
import { checkoutAdmissionArgsValidator } from "@repo/backend/convex/customers/checkout/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";

/** Mutation-ordered checkout admission with consent-aware optional analytics. */
export const admitCheckoutSession = internalMutation({
  args: checkoutAdmissionArgsValidator.fields,
  returns: v.boolean(),
  handler: (ctx, args) =>
    runConvexProgram(
      admitCheckoutProgram({
        captureEvent: () =>
          captureProductEvent(ctx, {
            distinctId: args.userId,
            event: args.event,
            timestamp:
              args.timestamp === undefined
                ? undefined
                : new Date(args.timestamp),
          }),
        loadUser: () => ctx.db.get("users", args.userId),
      })
    ),
});
