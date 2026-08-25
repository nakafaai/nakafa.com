"use node";

import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import type { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import type {
  ReadModelRestartArgs,
  ReadModelRestartResult,
  ReadModelStatus,
} from "@repo/backend/convex/contentRelease/models";
import { makeFunctionReference } from "convex/server";
import { Context, Duration, Effect, Layer } from "effect";

const modelStatusReference = makeFunctionReference<
  "query",
  { releaseId: string },
  ReadModelStatus
>("contentRelease/models:status");
const modelRestartReference = makeFunctionReference<
  "mutation",
  ReadModelRestartArgs,
  ReadModelRestartResult
>("contentRelease/models:restart");

export type ReadModelWaitPolicy = "observe" | "restart-failed-once";

export interface ReadModelCoordinatorService {
  /** Restarts only the exact generation and job observed as failed. */
  readonly restart: (
    args: ReadModelRestartArgs
  ) => Effect.Effect<ReadModelRestartResult, ReleaseError>;
  /** Reads the sole scheduler-owned status boundary for one active release. */
  readonly status: (
    releaseId: string
  ) => Effect.Effect<ReadModelStatus, ReleaseError>;
}

/** Private coordinator dependency for publication ingress read models. */
export class ReadModelCoordinator extends Context.Service<
  ReadModelCoordinator,
  ReadModelCoordinatorService
>()("@repo/backend/contentRelease/ReadModelCoordinator") {}

/** Binds one action context to the private read-model coordinator functions. */
export function makeReadModelCoordinatorLive(ctx: ActionCtx) {
  return Layer.succeed(ReadModelCoordinator, {
    restart: (args) =>
      callInternal(() => ctx.runMutation(modelRestartReference, args)),
    status: (releaseId) =>
      callInternal(() => ctx.runQuery(modelStatusReference, { releaseId })),
  });
}

/** Waits for convergence with at most one explicitly authorized restart. */
export const waitForReadModels: (
  releaseId: string,
  policy: ReadModelWaitPolicy
) => Effect.Effect<void, ReleaseError, ReadModelCoordinator> = Effect.fn(
  "contentRelease.waitForReadModels"
)(function* (releaseId: string, policy: ReadModelWaitPolicy) {
  const coordinator = yield* ReadModelCoordinator;
  let canRestart = policy === "restart-failed-once";

  while (true) {
    const status = yield* coordinator.status(releaseId);
    if (status.phase === "completed") {
      return;
    }
    if (status.phase === "failed") {
      if (!canRestart) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Read-model sync ${releaseId} failed before completion.`
        );
      }

      canRestart = false;
      yield* coordinator.restart({
        expectedGeneration: status.syncGeneration,
        expectedJobId: status.syncJobId,
        releaseId,
      });
      continue;
    }

    yield* Effect.sleep(Duration.millis(100));
  }
});
