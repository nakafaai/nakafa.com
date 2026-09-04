import { internal } from "@repo/backend/convex/_generated/api";
import { WELCOME_EMAIL_RETRY } from "@repo/backend/convex/emails/welcome/spec";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { workflow } from "@repo/backend/convex/workflow";
import type { FunctionReference } from "convex/server";
import { type ObjectType, v } from "convex/values";

const welcomeEmailWorkflowArgs = {
  intentId: vv.id("welcomeEmailIntents"),
};
type WelcomeEmailWorkflowArgs = ObjectType<typeof welcomeEmailWorkflowArgs>;
type SendWelcomeEmail = FunctionReference<
  "action",
  "internal",
  WelcomeEmailWorkflowArgs,
  null
>;

interface WelcomeEmailWorkflowStep {
  runAction(
    action: SendWelcomeEmail,
    args: WelcomeEmailWorkflowArgs,
    options: { readonly retry: typeof WELCOME_EMAIL_RETRY }
  ): Promise<null>;
}

/** Runs the durable provider action with the deletion-aware retry policy. */
export async function runWelcomeEmailDelivery(
  step: WelcomeEmailWorkflowStep,
  args: WelcomeEmailWorkflowArgs
): Promise<null> {
  await step.runAction(
    internal.emails.welcome.delivery.sendWelcomeEmail,
    args,
    { retry: WELCOME_EMAIL_RETRY }
  );
  return null;
}

/** Durably renders, enqueues, and checkpoints one welcome intent. */
export const deliverWelcomeEmail = workflow.define({
  args: welcomeEmailWorkflowArgs,
  returns: v.null(),
  handler: runWelcomeEmailDelivery,
});
