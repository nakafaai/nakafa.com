import type { GenericId } from "@confect/core";
import {
  DatabaseReader,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { EMAIL_FROM, sendMail } from "@repo/backend/confect/emails/client";
import { isLoginAddress } from "@repo/backend/confect/identity/address";
import { Clock, Effect } from "effect";

/**
 * Hands one rendered invitation to the mail provider, to the address of the
 * invite. The invite id and the moment of the send are the idempotency key, so
 * a retried step or a repeated run of one send sends one message, while a
 * resend, which has its own moment, sends again. An invite that was revoked
 * since it was rendered, whose term ended while the workflow waited, or whose
 * address is a school login's placeholder sends nothing.
 */
export const enqueueRenderedInviteProgram = Effect.fn("emails.invite.enqueue")(
  function* (
    inviteId: GenericId.GenericId<"tenantInvites">,
    requestedAt: number,
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
    const now = yield* Clock.currentTimeMillis;
    if (
      invite.state.status === "revoked" ||
      invite.expiresAt <= now ||
      isLoginAddress(invite.channel.email)
    ) {
      return null;
    }
    yield* sendMail(ctx, {
      ...message,
      from: EMAIL_FROM,
      idempotencyKey: `invite-email/${inviteId}/${requestedAt}`,
      to: invite.channel.email,
    }).pipe(Effect.orDie);
    return null;
  }
);
