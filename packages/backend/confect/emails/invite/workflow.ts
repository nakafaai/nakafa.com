import { Ref, SchemaToValidator } from "@confect/core";
import type { WorkflowCtx } from "@convex-dev/workflow";
import {
  type ActiveAppLocaleCode,
  ActiveAppLocaleCodeSchema,
} from "@nakafa/aksara-contracts/locale";
import refs from "@repo/backend/confect/_generated/refs";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { workflow } from "@repo/backend/confect/workflow";
import { type ObjectType, v } from "convex/values";
import { Effect } from "effect";

const inviteEmailWorkflowArgs = {
  inviteId: v.id("tenantInvites"),
  locale: SchemaToValidator.compileSchema(ActiveAppLocaleCodeSchema),
};
type InviteEmailWorkflowArgs = ObjectType<typeof inviteEmailWorkflowArgs>;
type InviteEmailWorkflowStep = Pick<
  WorkflowCtx,
  "runAction" | "runMutation" | "runQuery"
>;

/**
 * Reads what the invitation says, renders it, and hands it to the mail
 * provider: three durable steps. The render is the only step that retries,
 * with the default policy of the workflow component, because the other two are
 * transactions that Convex already retries on its own errors.
 */
export async function runInviteEmailDelivery(
  step: InviteEmailWorkflowStep,
  args: InviteEmailWorkflowArgs
): Promise<null> {
  const input = await step.runQuery(
    Ref.getFunctionReference(refs.internal.emails.invite.internal.readInput),
    args
  );
  if (input === null) {
    return null;
  }
  const message = await step.runAction(
    Ref.getFunctionReference(refs.internal.emails.invite.delivery.render),
    input,
    { retry: true }
  );
  await step.runMutation(
    Ref.getFunctionReference(
      refs.internal.emails.invite.internal.enqueueRendered
    ),
    { inviteId: args.inviteId, ...message }
  );
  return null;
}

/** Durably delivers one invitation email. */
export const deliverInviteEmail = workflow.define({
  args: inviteEmailWorkflowArgs,
  returns: v.null(),
  handler: runInviteEmailDelivery,
});

/**
 * Starts the delivery of one invitation email in the caller's transaction, so
 * the invite and its email exist together or not at all. `locale` is the
 * language of the email, chosen by whoever made the invite. When the delivery
 * ends, `finishInviteEmail` releases its journal.
 */
export const startInviteEmail = Effect.fn("emails.invite.start")(function* (
  inviteId: InviteEmailWorkflowArgs["inviteId"],
  locale: ActiveAppLocaleCode
) {
  const ctx = yield* MutationCtx;
  yield* Effect.promise(() =>
    workflow.start(
      ctx,
      Ref.getFunctionReference(
        refs.internal.emails.invite.workflow.deliverInviteEmail
      ),
      { inviteId, locale },
      {
        context: { inviteId },
        onComplete: Ref.getFunctionReference(
          refs.internal.emails.invite.workflow.finishInviteEmail
        ),
        startAsync: true,
      }
    )
  );
});
