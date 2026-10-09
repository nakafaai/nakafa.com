import type { WorkflowId } from "@convex-dev/workflow";
import type { ActiveAppLocaleCode } from "@nakafa/aksara-contracts/locale";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx as MutationCtxService,
} from "@repo/backend/confect/_generated/services";
import {
  toUserCleanupError,
  tryUserCleanup,
  USER_CLEANUP_FAILED_CODE,
  UserCleanupError,
} from "@repo/backend/confect/auth/cleanup/spec";
import { resend } from "@repo/backend/confect/emails/client";
import {
  WelcomeIntentDeferredError,
  WelcomeIntentError,
  welcomeIntentDeferredCode,
  welcomeIntentFailedCode,
} from "@repo/backend/confect/emails/welcome/spec";
import { workflow } from "@repo/backend/confect/workflow";
import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { Effect, flow } from "effect";
export function toWelcomeIntentError() {
  return WelcomeIntentError.make({
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
  return WelcomeIntentDeferredError.make({
    code: welcomeIntentDeferredCode,
    message: "Welcome email is deferred during account deletion preparation.",
  });
}
const readWelcomeIntentByUserId = Effect.fn("emails.welcome.readIntent")(
  function* (userId: Id<"users">) {
    return yield* (yield* DatabaseReader)
      .table("welcomeEmailIntents")
      .get("by_userId", userId)
      .pipe(Effect.catchTag("GetByIndexFailure", () => Effect.succeed(null)));
  }
);

/** Declares the only welcome-email cohort intent when the app user is created. */
export const declareWelcomeIntent = Effect.fn("emails.welcome.declareIntent")(
  function* (userId: Id<"users">) {
    const writer = yield* DatabaseWriter;
    const existing = yield* readWelcomeIntentByUserId(userId).pipe(
      Effect.mapError(toWelcomeIntentError)
    );
    if (existing) {
      return existing._id;
    }
    return yield* writer
      .table("welcomeEmailIntents")
      .insert({
        phase: "awaiting-onboarding",
        userId,
      })
      .pipe(Effect.orDie);
  },
  Effect.catchDefect(flow(toWelcomeIntentError, Effect.fail))
);

/**
 * Activates only an intent declared at user creation. Historical accounts are
 * not backfilled because their legacy welcome delivery cannot be proven.
 */
export const activateWelcomeIntent = Effect.fn("emails.welcome.activateIntent")(
  function* (userId: Id<"users">, locale: ActiveAppLocaleCode) {
    const ctx = yield* MutationCtxService;
    const writer = yield* DatabaseWriter;
    const intent = yield* readWelcomeIntentByUserId(userId).pipe(
      Effect.mapError(toWelcomeIntentError)
    );
    if (intent?.phase !== "awaiting-onboarding") {
      return false;
    }
    const workflowId: WorkflowId = yield* tryWelcomeIntent(() =>
      workflow.start(
        ctx,
        internal.emails.welcome.workflow.deliverWelcomeEmail,
        {
          intentId: intent._id,
        },
        {
          startAsync: true,
        }
      )
    );
    yield* writer
      .table("welcomeEmailIntents")
      .replace(intent._id, {
        locale,
        phase: "scheduled",
        userId,
        workflowId,
      })
      .pipe(Effect.orDie);
    return true;
  },
  Effect.catchDefect(flow(toWelcomeIntentError, Effect.fail))
);

/** Cancels pending work and erases the app-owned intent during account deletion. */
export const removeWelcomeIntent = Effect.fn("emails.welcome.removeIntent")(
  function* (userId: Id<"users">) {
    const ctx = yield* MutationCtxService;
    const writer = yield* DatabaseWriter;
    const intent = yield* readWelcomeIntentByUserId(userId).pipe(
      Effect.mapError(toUserCleanupError)
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
        return yield* UserCleanupError.make({
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
    yield* writer.table("welcomeEmailIntents").delete(intent._id);
  },
  Effect.catchDefect(flow(toUserCleanupError, Effect.fail))
);
