import type { Docs } from "@repo/backend/confect/_generated/docs";
import refs from "@repo/backend/confect/_generated/refs";
import {
  DatabaseReader,
  DatabaseWriter,
  MutationCtx as MutationCtxService,
  Scheduler,
} from "@repo/backend/confect/_generated/services";
import { resend } from "@repo/backend/confect/emails/client";
import {
  toWelcomeIntentError,
  tryWelcomeIntent,
} from "@repo/backend/confect/emails/welcome/impl";
import type { welcomeIntentReconciliationPhaseValidator } from "@repo/backend/confect/emails/welcome/reconciliation.spec";
import { workflow } from "@repo/backend/confect/workflow";
import { Duration, Effect, flow, Result } from "effect";

type WelcomeIntentReconciliationPhase =
  typeof welcomeIntentReconciliationPhaseValidator.Type;
/** Maximum app intents one reconciliation transaction may inspect. */
const welcomeIntentReconciliationPageSize = 32;

/** Maximum app-table bytes one reconciliation transaction may read. */
const welcomeIntentReconciliationPageBytes = 4 * 1024 * 1024;
const scheduleNextReconciliationPage = Effect.fn(
  "emails.welcome.scheduleReconciliation"
)(
  function* (
    phase: WelcomeIntentReconciliationPhase,
    page: {
      readonly continueCursor: string;
      readonly isDone: boolean;
    }
  ) {
    if (page.isDone && phase !== "scheduled") {
      return;
    }
    const scheduler = yield* Scheduler;
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
const reconcileWelcomeIntent = Effect.fn("emails.welcome.reconcileIntent")(
  function* (intent: Docs["welcomeEmailIntents"]) {
    const ctx = yield* MutationCtxService;
    const writer = yield* DatabaseWriter;
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
)(function* (phase: WelcomeIntentReconciliationPhase, cursor: string | null) {
  const page = yield* (yield* DatabaseReader)
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
    yield* reconcileWelcomeIntent(intent);
  }
  yield* scheduleNextReconciliationPage(phase, page);
  return null;
});

/** Finalizes terminal workflows, then releases non-cancellable email handles. */
