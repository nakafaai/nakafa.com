import type { EmailStatus } from "@convex-dev/resend";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  tryUserCleanup,
  type UserCleanupError,
} from "@repo/backend/convex/auth/cleanup/spec";
import { resend } from "@repo/backend/convex/emails/mutations";
import { Effect } from "effect";

interface WelcomeEmailCancellationOperations {
  readonly cancel: () => Promise<unknown>;
  readonly clear: () => Promise<unknown>;
  readonly loadStatus: () => Promise<EmailStatus | null>;
}

/** Cancels one queued welcome email when account deletion becomes irreversible. */
export const cancelWelcomeEmailProgram: (
  operations: WelcomeEmailCancellationOperations
) => Effect.Effect<void, UserCleanupError> = Effect.fn(
  "emails.deletion.cancelWelcomeEmail"
)(function* (operations: WelcomeEmailCancellationOperations) {
  const status = yield* tryUserCleanup(operations.loadStatus);

  if (status?.status === "waiting" || status?.status === "queued") {
    yield* tryUserCleanup(operations.cancel);
  }

  yield* tryUserCleanup(operations.clear);
});

/**
 * Cancels component delivery and clears the app-owned handle in the irreversible
 * claim transaction. Convex commits component and app writes transactionally,
 * so a recoverable preparation never loses the surviving account's email.
 */
export const cancelPendingWelcomeEmail = Effect.fn(
  "emails.deletion.cancelPendingWelcomeEmail"
)(function* (ctx: MutationCtx, user: Doc<"users">) {
  const emailId = user.welcomeEmailId;

  if (!emailId) {
    return;
  }

  yield* cancelWelcomeEmailProgram({
    cancel: () => resend.cancelEmail(ctx, emailId),
    clear: () =>
      ctx.db.patch("users", user._id, {
        welcomeEmailId: undefined,
      }),
    loadStatus: () => resend.status(ctx, emailId),
  });
});
