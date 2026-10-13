import type { GenericId } from "@confect/core";
import {
  DatabaseReader,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { EMAIL_FROM, resend } from "@repo/backend/confect/emails/client";
import { Effect } from "effect";

/**
 * Hands one rendered invitation to the mail provider, to the address of the
 * invite. The invite id is the idempotency key, so a retried step or a repeated
 * run sends one message. An invite that was revoked since it was rendered sends
 * nothing.
 */
export const enqueueRenderedInviteProgram = Effect.fn("emails.invite.enqueue")(
  function* (
    inviteId: GenericId.GenericId<"tenantInvites">,
    message: {
      readonly html: string;
      readonly subject: string;
      readonly text: string;
    }
  ) {
    const ctx = yield* MutationCtx;
    const invite = yield* (yield* DatabaseReader)
      .table("tenantInvites")
      .get(inviteId)
      .pipe(Effect.orDie);
    if (invite.state.status === "revoked") {
      return null;
    }
    yield* Effect.promise(() =>
      resend.sendEmail(ctx, {
        ...message,
        from: EMAIL_FROM,
        idempotencyKey: `invite-email/${inviteId}`,
        to: invite.channel.email,
      })
    );
    return null;
  }
);
