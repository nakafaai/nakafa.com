import { Resend } from "@convex-dev/resend";
import { components } from "@repo/backend/convex/_generated/api";

/** Shared Resend component boundary for delivery and cancellation. */
export const resend = new Resend(components.resend, {
  testMode: false,
});
