import type { WorkflowCtx } from "@convex-dev/workflow";
import { WELCOME_EMAIL_RETRY } from "@repo/backend/confect/emails/welcome/spec";
import { workflow } from "@repo/backend/confect/workflow";
import { internal } from "@repo/backend/convex/_generated/api";
import { type ObjectType, v } from "convex/values";

const welcomeEmailWorkflowArgs = {
  intentId: v.id("welcomeEmailIntents"),
};
type WelcomeEmailWorkflowArgs = ObjectType<typeof welcomeEmailWorkflowArgs>;
type WelcomeEmailWorkflowStep = Pick<WorkflowCtx, "runAction">;

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
