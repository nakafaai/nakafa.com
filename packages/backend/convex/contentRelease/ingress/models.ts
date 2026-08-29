"use node";

import type { ActionCtx } from "@repo/backend/convex/_generated/server";
import type { ReleaseError } from "@repo/backend/convex/contentRelease/error";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { callInternal } from "@repo/backend/convex/contentRelease/ingress/call";
import type {
  ModelBuildRestartArgs,
  ModelBuildRestartResult,
  ModelBuildStatus,
} from "@repo/backend/convex/contentRelease/models/spec";
import { makeFunctionReference } from "convex/server";
import { Context, Duration, Effect, Layer } from "effect";

const modelStatusReference = makeFunctionReference<
  "query",
  { releaseId: string },
  ModelBuildStatus
>("contentRelease/models:status");
const modelRestartReference = makeFunctionReference<
  "mutation",
  ModelBuildRestartArgs,
  ModelBuildRestartResult
>("contentRelease/models:restart");

export type ModelBuildWaitPolicy = "observe" | "restart-failed-once";

export interface ModelBuildCoordinatorService {
  readonly restart: (
    args: ModelBuildRestartArgs
  ) => Effect.Effect<ModelBuildRestartResult, ReleaseError>;
  readonly status: (
    releaseId: string
  ) => Effect.Effect<ModelBuildStatus, ReleaseError>;
}

/** Private dependency for one candidate read-model build lineage. */
export class ModelBuildCoordinator extends Context.Service<
  ModelBuildCoordinator,
  ModelBuildCoordinatorService
>()("@repo/backend/contentRelease/ModelBuildCoordinator") {}

/** Binds one action context to the private model build functions. */
export function makeModelBuildCoordinatorLive(ctx: ActionCtx) {
  return Layer.succeed(ModelBuildCoordinator, {
    restart: (args) =>
      callInternal(() => ctx.runMutation(modelRestartReference, args)),
    status: (releaseId) =>
      callInternal(() => ctx.runQuery(modelStatusReference, { releaseId })),
  });
}

/** Waits for actual readiness with at most one fenced failed-job restart. */
export const waitForModelBuild: (
  releaseId: string,
  policy: ModelBuildWaitPolicy
) => Effect.Effect<void, ReleaseError, ModelBuildCoordinator> = Effect.fn(
  "contentRelease.waitForModelBuild"
)(function* (releaseId: string, policy: ModelBuildWaitPolicy) {
  const coordinator = yield* ModelBuildCoordinator;
  let canRestart = policy === "restart-failed-once";
  while (true) {
    const status = yield* coordinator.status(releaseId);
    if (status.phase === "ready" || status.phase === "completed") {
      return;
    }
    if (status.phase === "failed") {
      if (!canRestart) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          `Model build ${releaseId} failed before readiness.`
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
