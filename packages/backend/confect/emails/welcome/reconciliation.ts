import refs from "@repo/backend/confect/_generated/refs";
import { resend } from "@repo/backend/confect/emails/client";
import {
  toWelcomeIntentError,
  tryWelcomeIntent,
} from "@repo/backend/confect/emails/welcome/impl";
import type { welcomeIntentReconciliationPhaseValidator } from "@repo/backend/confect/emails/welcome/reconciliation.spec";
import { workflow } from "@repo/backend/confect/workflow";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Duration, Effect, flow, Result, type Schema } from "effect";
export type WelcomeIntentReconciliationPhase = Schema.Schema.Type<
  typeof welcomeIntentReconciliationPhaseValidator
>;
/** Maximum app intents one reconciliation transaction may inspect. */
export const welcomeIntentReconciliationPageSize = 32;

/** Maximum app-table bytes one reconciliation transaction may read. */
export const welcomeIntentReconciliationPageBytes = 4 * 1024 * 1024;
export const scheduleNextReconciliationPage = Effect.fn(
  "emails.welcome.scheduleReconciliation"
)(
  function* (
    ctx: MutationCtx,
    phase: WelcomeIntentReconciliationPhase,
    page: { readonly continueCursor: string; readonly isDone: boolean }
  ) {
    if (page.isDone && phase !== "scheduled") {
      return;
    }
    const scheduler = yield* Scheduler.Scheduler.pipe(
      Effect.provide(Scheduler.layer(ctx.scheduler))
    );
    yield* scheduler.runAfter(
      Duration.zero,
      refs.internal.emails.welcome.reconciliation
        .reconcileWelcomeIntentLifecycle,
      {
        cursor: page.isDone ? null : page.continueCursor,
        phase: page.isDone ? "enqueued" : phase,
      }
    );
  },
  Effect.catchDefect(flow(toWelcomeIntentError, Effect.fail))
);

/** Finalizes one intent only after its workflow and email component are terminal. */
export const reconcileWelcomeIntent = Effect.fn(
  "emails.welcome.reconcileIntent"
)(
  function* (ctx: MutationCtx, intent: Docs["welcomeEmailIntents"]) {
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const workflowId = "workflowId" in intent ? intent.workflowId : undefined;
    if (workflowId !== undefined) {
      const status = yield* tryWelcomeIntent(() =>
        workflow.status(ctx, workflowId)
      );
      if (status.type === "inProgress") {
        return;
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
        yield* writer.table("welcomeEmailIntents").delete(intent._id);
      } else {
        yield* writer
          .table("welcomeEmailIntents")
          .patch(intent._id, {
            workflowId: undefined,
          })
          .pipe(Effect.orDie);
      }
    }
    if (intent.phase === "enqueued") {
      const status = yield* Effect.result(
        tryWelcomeIntent(() => resend.status(ctx, intent.componentEmailId))
      );
      if (Result.isFailure(status)) {
        yield* Effect.logWarning(
          "Welcome intent retained after component status inspection failed."
        );
        return;
      }
      if (
        status.success?.status === "waiting" ||
        status.success?.status === "queued"
      ) {
        return;
      }
      yield* writer.table("welcomeEmailIntents").delete(intent._id);
    }
  },
  Effect.catchDefect(flow(toWelcomeIntentError, Effect.fail))
);
export const reconcileWelcomeIntentLifecycleProgram = Effect.fn(
  "emails.welcome.reconcileLifecycle"
)(function* (
  ctx: MutationCtx,
  phase: WelcomeIntentReconciliationPhase,
  cursor: string | null
) {
  const page = yield* DatabaseReader.make(databaseSchema, ctx.db)
    .table("welcomeEmailIntents")
    .index("by_phase", (query) => query.eq("phase", phase))
    .paginate({
      cursor,
      maximumBytesRead: welcomeIntentReconciliationPageBytes,
      maximumRowsRead: welcomeIntentReconciliationPageSize,
      numItems: welcomeIntentReconciliationPageSize,
    })
    .pipe(Effect.mapError(toWelcomeIntentError));
  for (const intent of page.page) {
    yield* reconcileWelcomeIntent(ctx, intent);
  }
  yield* scheduleNextReconciliationPage(ctx, phase, page);
  return null;
});

/** Finalizes terminal workflows, then releases non-cancellable email handles. */
import { DatabaseReader, DatabaseWriter, Scheduler } from "@confect/server";
import type { Docs } from "@repo/backend/confect/_generated/docs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
