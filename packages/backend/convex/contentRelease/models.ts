import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  internalMutation,
  internalQuery,
} from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { loadState } from "@repo/backend/convex/contentRelease/model";
import {
  loadModelBuild,
  loadModelBuildRelease,
} from "@repo/backend/convex/contentRelease/models/build";
import { advanceModelPage } from "@repo/backend/convex/contentRelease/models/page";
import { nextModelPhase } from "@repo/backend/convex/contentRelease/models/phase";
import {
  type ModelBuildRestartArgs,
  type ModelBuildRestartResult,
  type ModelBuildStatus,
  modelBuildRestartArgsValidator,
  modelBuildRestartResultValidator,
  modelBuildStatusValidator,
} from "@repo/backend/convex/contentRelease/models/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference, type SystemDataModel } from "convex/server";
import { v } from "convex/values";
import { Clock, Effect } from "effect";

type ScheduledFunction = SystemDataModel["_scheduled_functions"]["document"];

const resumeReference = makeFunctionReference<
  "mutation",
  { generation: number; releaseId: string },
  null
>("contentRelease/models:resume");

/** Reports whether one scheduler job can still make forward progress. */
function isRunningJob(job: ScheduledFunction | null) {
  return job?.state.kind === "pending" || job?.state.kind === "inProgress";
}

/** Reads the durable state of one inactive-buffer build lineage. */
const readModelStatus = Effect.fn("contentRelease.readModelStatus")(function* (
  ctx: QueryCtx,
  releaseId: string
) {
  const [build, state] = yield* Effect.all([
    loadModelBuild(ctx),
    loadState(ctx),
  ]);
  if (build?.releaseId !== releaseId) {
    if (state?.activeReleaseId === releaseId) {
      return { phase: "completed", releaseId } satisfies ModelBuildStatus;
    }
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Model build ${releaseId} does not own the coordinator.`
    );
  }
  if (build.phase === "ready") {
    return { phase: "ready", releaseId } satisfies ModelBuildStatus;
  }
  const syncJobId = build.syncJobId;
  if (syncJobId === undefined) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Model build ${releaseId} lost its scheduler identity.`
    );
  }
  const job = yield* Effect.promise(() =>
    ctx.db.system.get("_scheduled_functions", syncJobId)
  );
  return {
    phase: isRunningJob(job) ? "building" : "failed",
    releaseId,
    syncGeneration: build.generation,
    syncJobId,
  } satisfies ModelBuildStatus;
});

/** Executes one generation-fenced page and schedules its sole successor. */
const resumeModelBuild = Effect.fn("contentRelease.resumeModelBuild")(
  function* (ctx: MutationCtx, releaseId: string, generation: number) {
    const build = yield* loadModelBuild(ctx);
    if (
      !build ||
      build.releaseId !== releaseId ||
      build.generation !== generation ||
      build.phase === "ready"
    ) {
      return null;
    }
    const { release, signed } = yield* loadModelBuildRelease(ctx, build);
    const progress = yield* advanceModelPage(ctx, build, release, signed);
    if (!progress.done && progress.processed === 0) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Model build ${releaseId} stopped without progress in ${build.phase}.`
      );
    }
    const phase = progress.done
      ? nextModelPhase(build, build.phase)
      : build.phase;
    const resetItems = progress.done && build.phase.endsWith("Verify");
    const cursor = "cursor" in progress ? progress.cursor : undefined;
    const itemIndex = "itemIndex" in progress ? progress.itemIndex : undefined;
    const syncJobId =
      phase === "ready"
        ? undefined
        : yield* Effect.promise(() =>
            ctx.scheduler.runAfter(0, resumeReference, {
              generation,
              releaseId,
            })
          );
    const updatedAt = yield* Clock.currentTimeMillis;
    yield* Effect.promise(() =>
      ctx.db.patch("contentModelBuilds", build._id, {
        cursor: progress.done ? undefined : cursor,
        itemIndex: itemIndex ?? (resetItems ? -1 : build.itemIndex),
        phase,
        syncJobId,
        updatedAt,
      })
    );
    return null;
  }
);

/** Restarts one failed lineage only while its observed fence still wins. */
const restartModelBuild = Effect.fn("contentRelease.restartModelBuild")(
  function* (ctx: MutationCtx, args: ModelBuildRestartArgs) {
    const build = yield* loadModelBuild(ctx);
    if (
      !build ||
      build.releaseId !== args.releaseId ||
      build.phase === "ready" ||
      build.generation !== args.expectedGeneration ||
      build.syncJobId !== args.expectedJobId
    ) {
      return { status: "stale" } satisfies ModelBuildRestartResult;
    }
    const job = yield* Effect.promise(() =>
      ctx.db.system.get("_scheduled_functions", args.expectedJobId)
    );
    if (isRunningJob(job)) {
      return { status: "stale" } satisfies ModelBuildRestartResult;
    }
    const syncGeneration = args.expectedGeneration + 1;
    const syncJobId = yield* Effect.promise(() =>
      ctx.scheduler.runAfter(0, resumeReference, {
        generation: syncGeneration,
        releaseId: args.releaseId,
      })
    );
    const updatedAt = yield* Clock.currentTimeMillis;
    yield* Effect.promise(() =>
      ctx.db.patch("contentModelBuilds", build._id, {
        generation: syncGeneration,
        syncJobId,
        updatedAt,
      })
    );
    return {
      status: "restarted",
      syncGeneration,
      syncJobId,
    } satisfies ModelBuildRestartResult;
  }
);

export const restart = internalMutation({
  args: modelBuildRestartArgsValidator,
  returns: modelBuildRestartResultValidator,
  handler: (ctx, args) => runConvexProgram(restartModelBuild(ctx, args)),
});

export const status = internalQuery({
  args: { releaseId: v.string() },
  returns: modelBuildStatusValidator,
  handler: (ctx, { releaseId }) =>
    runConvexProgram(readModelStatus(ctx, releaseId)),
});

export const resume = internalMutation({
  args: { generation: v.number(), releaseId: v.string() },
  returns: v.null(),
  handler: (ctx, { generation, releaseId }) =>
    runConvexProgram(resumeModelBuild(ctx, releaseId, generation)),
});
