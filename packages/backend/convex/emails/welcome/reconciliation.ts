import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { resend } from "@repo/backend/convex/emails/client";
import {
  toWelcomeIntentError,
  tryWelcomeIntent,
} from "@repo/backend/convex/emails/welcome/impl";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { workflow } from "@repo/backend/convex/workflow";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";
import { Effect, Result } from "effect";

const welcomeIntentReconciliationPhaseValidator = literals(
  "scheduled",
  "enqueued"
);
type WelcomeIntentReconciliationPhase = Infer<
  typeof welcomeIntentReconciliationPhaseValidator
>;

const reconcileWelcomeIntentLifecycleReference = makeFunctionReference<
  "mutation",
  {
    cursor: string | null;
    phase: WelcomeIntentReconciliationPhase;
  },
  null
>("emails/welcome/reconciliation:reconcileWelcomeIntentLifecycle");

/** Maximum app intents one reconciliation transaction may inspect. */
export const welcomeIntentReconciliationPageSize = 32;

/** Maximum app-table bytes one reconciliation transaction may read. */
export const welcomeIntentReconciliationPageBytes = 4 * 1024 * 1024;

function scheduleNextReconciliationPage(
  ctx: MutationCtx,
  phase: WelcomeIntentReconciliationPhase,
  page: {
    readonly continueCursor: string;
    readonly isDone: boolean;
  }
) {
  if (!page.isDone) {
    return tryWelcomeIntent(() =>
      ctx.scheduler.runAfter(0, reconcileWelcomeIntentLifecycleReference, {
        cursor: page.continueCursor,
        phase,
      })
    );
  }

  if (phase === "scheduled") {
    return tryWelcomeIntent(() =>
      ctx.scheduler.runAfter(0, reconcileWelcomeIntentLifecycleReference, {
        cursor: null,
        phase: "enqueued",
      })
    );
  }

  return Effect.void;
}

const reconcileWelcomeIntentLifecycleProgram = Effect.fn(
  "emails.welcome.reconcileLifecycle"
)(function* (
  ctx: MutationCtx,
  phase: WelcomeIntentReconciliationPhase,
  cursor: string | null
) {
  const page = yield* tryWelcomeIntent(() =>
    ctx.db
      .query("welcomeEmailIntents")
      .withIndex("by_phase", (query) => query.eq("phase", phase))
      .paginate({
        cursor,
        maximumBytesRead: welcomeIntentReconciliationPageBytes,
        maximumRowsRead: welcomeIntentReconciliationPageSize,
        numItems: welcomeIntentReconciliationPageSize,
      })
  );

  for (const intent of page.page) {
    if (intent.phase === "awaiting-onboarding") {
      continue;
    }

    const workflowId = intent.workflowId;
    if (workflowId !== undefined) {
      const status = yield* tryWelcomeIntent(() =>
        workflow.status(ctx, workflowId)
      );
      if (status.type === "inProgress") {
        continue;
      }

      const cleaned = yield* tryWelcomeIntent(() =>
        workflow.cleanup(ctx, workflowId)
      );
      if (!cleaned) {
        return yield* toWelcomeIntentError();
      }

      if (status.type === "failed") {
        yield* Effect.logError("Welcome email workflow failed.");
      }
      if (intent.phase === "scheduled") {
        yield* tryWelcomeIntent(() => ctx.db.delete(intent._id));
        continue;
      }

      yield* tryWelcomeIntent(() =>
        ctx.db.patch(intent._id, { workflowId: undefined })
      );
    }

    if (intent.phase !== "enqueued") {
      continue;
    }

    const status = yield* Effect.result(
      tryWelcomeIntent(() => resend.status(ctx, intent.componentEmailId))
    );
    if (Result.isFailure(status)) {
      yield* Effect.logWarning(
        "Welcome intent retained after component status inspection failed."
      );
      continue;
    }
    if (
      status.success?.status === "waiting" ||
      status.success?.status === "queued"
    ) {
      continue;
    }

    yield* tryWelcomeIntent(() => ctx.db.delete(intent._id));
  }

  yield* scheduleNextReconciliationPage(ctx, phase, page);
  return null;
});

/** Finalizes terminal workflows, then releases non-cancellable email handles. */
export const reconcileWelcomeIntentLifecycle = internalMutation({
  args: {
    cursor: v.union(v.null(), v.string()),
    phase: welcomeIntentReconciliationPhaseValidator,
  },
  returns: v.null(),
  handler: (ctx, { cursor, phase }) =>
    runConvexProgram(
      reconcileWelcomeIntentLifecycleProgram(ctx, phase, cursor)
    ),
});
