import { Resend } from "@convex-dev/resend";
import { components } from "@repo/backend/convex/_generated/api";

/** The one sender of every Nakafa email. */
export const EMAIL_FROM = "Nakafa <nakafa@notifications.nakafa.com>";

/** Shared Resend component boundary for delivery and cancellation. */
export const resend = new Resend(components.resend, {
  testMode: false,
});
