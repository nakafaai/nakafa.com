import type { WorkflowId } from "@convex-dev/workflow";
import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  tryUserCleanup,
  USER_CLEANUP_FAILED_CODE,
  UserCleanupError,
} from "@repo/backend/convex/auth/cleanup/spec";
import { resend } from "@repo/backend/convex/emails/client";
import { workflow } from "@repo/backend/convex/workflow";
import { Effect, Schema } from "effect";

const welcomeIntentFailedCode = "WELCOME_INTENT_FAILED";
const welcomeIntentDeferredCode = "WELCOME_INTENT_DEFERRED";

/** Expected failure while declaring or activating one welcome intent. */
export class WelcomeIntentError extends Schema.TaggedError<WelcomeIntentError>()(
  "WelcomeIntentError",
  {
    code: Schema.Literal(welcomeIntentFailedCode),
    message: Schema.String,
  }
) {}

/** Retryable pause while reversible account deletion is active. */
export class WelcomeIntentDeferredError extends Schema.TaggedError<WelcomeIntentDeferredError>()(
  "WelcomeIntentDeferredError",
  {
    code: Schema.Literal(welcomeIntentDeferredCode),
    message: Schema.String,
  }
) {}

export function toWelcomeIntentError() {
  return new WelcomeIntentError({
    code: welcomeIntentFailedCode,
    message: "Unable to process the welcome email intent.",
  });
}

export function tryWelcomeIntent<A>(operation: () => Promise<A>) {
  return Effect.tryPromise({
    catch: toWelcomeIntentError,
    try: operation,
  });
}

export function deferWelcomeIntent() {
  return new WelcomeIntentDeferredError({
    code: welcomeIntentDeferredCode,
    message: "Welcome email is deferred during account deletion preparation.",
  });
}

function readWelcomeIntentByUserId(ctx: MutationCtx, userId: Id<"users">) {
  return ctx.db
    .query("welcomeEmailIntents")
    .withIndex("by_userId", (query) => query.eq("userId", userId))
    .unique();
}

/** Declares the only welcome-email cohort intent when the app user is created. */
export const declareWelcomeIntent = Effect.fn("emails.welcome.declareIntent")(
  function* (ctx: MutationCtx, userId: Id<"users">) {
    const existing = yield* tryWelcomeIntent(() =>
      readWelcomeIntentByUserId(ctx, userId)
    );
    if (existing) {
      return existing._id;
    }

    return yield* tryWelcomeIntent(() =>
      ctx.db.insert("welcomeEmailIntents", {
        phase: "awaiting-onboarding",
        userId,
      })
    );
  }
);

/**
 * Activates only an intent declared at user creation. Historical accounts are
 * not backfilled because their legacy welcome delivery cannot be proven.
 */
export const activateWelcomeIntent: (
  ctx: MutationCtx,
  userId: Id<"users">,
  locale: ActiveAppLocaleCode
) => Effect.Effect<boolean, WelcomeIntentError> = Effect.fn(
  "emails.welcome.activateIntent"
)(function* (
  ctx: MutationCtx,
  userId: Id<"users">,
  locale: ActiveAppLocaleCode
) {
  const intent = yield* tryWelcomeIntent(() =>
    readWelcomeIntentByUserId(ctx, userId)
  );
  if (intent?.phase !== "awaiting-onboarding") {
    return false;
  }

  const workflowId: WorkflowId = yield* tryWelcomeIntent(() =>
    workflow.start(
      ctx,
      internal.emails.welcome.workflow.deliverWelcomeEmail,
      { intentId: intent._id },
      {
        startAsync: true,
      }
    )
  );

  yield* tryWelcomeIntent(() =>
    ctx.db.replace(intent._id, {
      locale,
      phase: "scheduled",
      userId,
      workflowId,
    })
  );

  return true;
});

/** Cancels pending work and erases the app-owned intent during account deletion. */
export const removeWelcomeIntent: (
  ctx: MutationCtx,
  userId: Id<"users">
) => Effect.Effect<void, UserCleanupError> = Effect.fn(
  "emails.welcome.removeIntent"
)(function* (ctx: MutationCtx, userId: Id<"users">) {
  const intent = yield* tryUserCleanup(() =>
    readWelcomeIntentByUserId(ctx, userId)
  );
  if (!intent) {
    return;
  }

  const workflowId = "workflowId" in intent ? intent.workflowId : undefined;
  if (workflowId !== undefined) {
    const workflowStatus = yield* tryUserCleanup(() =>
      workflow.status(ctx, workflowId)
    );
    if (workflowStatus.type === "inProgress") {
      yield* tryUserCleanup(() => workflow.cancel(ctx, workflowId));
    }
    const cleaned = yield* tryUserCleanup(() =>
      workflow.cleanup(ctx, workflowId)
    );
    if (!cleaned) {
      return yield* new UserCleanupError({
        code: USER_CLEANUP_FAILED_CODE,
        message: "Unable to clean the welcome email workflow.",
      });
    }
  }

  if (intent.phase === "enqueued") {
    const status = yield* tryUserCleanup(() =>
      resend.status(ctx, intent.componentEmailId)
    );
    if (status?.status === "waiting" || status?.status === "queued") {
      yield* tryUserCleanup(() =>
        resend.cancelEmail(ctx, intent.componentEmailId)
      );
    }
  }

  yield* tryUserCleanup(() => ctx.db.delete(intent._id));
});
