import { internal } from "@repo/backend/convex/_generated/api";
import { WELCOME_EMAIL_RETRY } from "@repo/backend/convex/emails/welcome/spec";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { workflow } from "@repo/backend/convex/workflow";
import { v } from "convex/values";

/** Durably renders, enqueues, and checkpoints one welcome intent. */
export const deliverWelcomeEmail = workflow.define({
  args: { intentId: vv.id("welcomeEmailIntents") },
  returns: v.null(),
  handler: async (step, args) => {
    await step.runAction(
      internal.emails.welcome.delivery.sendWelcomeEmail,
      args,
      { retry: WELCOME_EMAIL_RETRY }
    );
    return null;
  },
});
