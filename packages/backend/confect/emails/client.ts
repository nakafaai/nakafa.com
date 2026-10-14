import { Resend, type SendEmailOptions } from "@convex-dev/resend";
import { isLoginAddress } from "@repo/backend/confect/identity/address";
import { components } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Array as Arr, Effect, Schema } from "effect";

/** The one sender of every Nakafa email. */
export const EMAIL_FROM = "Nakafa <nakafa@notifications.nakafa.com>";

/** Shared Resend component boundary for delivery and cancellation. */
export const resend = new Resend(components.resend, {
  testMode: false,
});

/**
 * A message to a placeholder address of a school login. No mail reaches that
 * address, so the sender refuses it before the provider is called.
 */
export class LoginAddressRefused extends Schema.TaggedError<LoginAddressRefused>()(
  "LoginAddressRefused",
  {
    code: Schema.Literal("LOGIN_ADDRESS_REFUSED"),
    message: Schema.String,
  }
) {}

/**
 * Hands one message to the mail provider, and refuses a message that names a
 * login address among its recipients. Every Nakafa sender goes through here, so
 * no path can mail a placeholder.
 */
export const sendMail = Effect.fn("emails.client.send")(function* (
  ctx: MutationCtx,
  message: SendEmailOptions
) {
  if (Arr.some(Arr.ensure(message.to), isLoginAddress)) {
    return yield* new LoginAddressRefused({
      code: "LOGIN_ADDRESS_REFUSED",
      message: "A school login address never receives mail.",
    });
  }
  return yield* Effect.promise(() => resend.sendEmail(ctx, message));
});
