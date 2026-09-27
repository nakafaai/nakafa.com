import { DatabaseReader, DatabaseWriter, Scheduler } from "@confect/server";
import refs from "@repo/backend/confect/_generated/refs";
import databaseSchema from "@repo/backend/confect/_generated/schema";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { loadState } from "@repo/backend/confect/contentRelease/model";
import {
  loadModelBuild,
  loadModelBuildRelease,
} from "@repo/backend/confect/contentRelease/models/build";
import { advanceModelPage } from "@repo/backend/confect/contentRelease/models/page";
import { nextModelPhase } from "@repo/backend/confect/contentRelease/models/phase";
import type {
  ModelBuildRestartArgs,
  ModelBuildRestartResult,
  ModelBuildStatus,
} from "@repo/backend/confect/contentRelease/models/spec";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import type { SystemDataModel } from "convex/server";
import { Clock, Duration, Effect } from "effect";

type ScheduledFunction = SystemDataModel["_scheduled_functions"]["document"];
/** Reports whether one scheduler job can still make forward progress. */
export function isRunningJob(job: Pick<ScheduledFunction, "state"> | null) {
  return job?.state.kind === "pending" || job?.state.kind === "inProgress";
}

/** Reads the durable state of one inactive-buffer build lineage. */
export const readModelStatus = Effect.fn("contentRelease.readModelStatus")(
  function* (ctx: QueryCtx, releaseId: string) {
    const [build, state] = yield* Effect.all([
      loadModelBuild(ctx),
      loadState(ctx),
    ]);
    if (build?.releaseId !== releaseId) {
      if (state?.activeReleaseId === releaseId) {
        return {
          phase: "completed",
          releaseId,
        } satisfies ModelBuildStatus;
      }
      return yield* releaseFail(
        "CONTENT_RELEASE_STATE",
        `Model build ${releaseId} does not own the coordinator.`
      );
    }
    if (build.phase === "ready") {
      return {
        phase: "ready",
        releaseId,
      } satisfies ModelBuildStatus;
    }
    const syncJobId = build.syncJobId;
    if (syncJobId === undefined) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Model build ${releaseId} lost its scheduler identity.`
      );
    }
    const job = yield* DatabaseReader.make(databaseSchema, ctx.db)
      .table("_scheduled_functions")
      .get(syncJobId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    return {
      phase: isRunningJob(job) ? "building" : "failed",
      releaseId,
      syncGeneration: build.generation,
      syncJobId,
    } satisfies ModelBuildStatus;
  }
);

/** Executes one generation-fenced page and schedules its sole successor. */
export const resumeModelBuild = Effect.fn("contentRelease.resumeModelBuild")(
  function* (ctx: MutationCtx, releaseId: string, generation: number) {
    const scheduler = yield* Scheduler.Scheduler.pipe(
      Effect.provide(Scheduler.layer(ctx.scheduler))
    );
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
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
    const phase = progress.done
      ? nextModelPhase(build, build.phase)
      : build.phase;
    const resetItems = progress.done && build.phase.endsWith("Verify");
    const cursor = "cursor" in progress ? progress.cursor : undefined;
    const itemIndex = "itemIndex" in progress ? progress.itemIndex : undefined;
    const syncJobId =
      phase === "ready"
        ? undefined
        : yield* scheduler.runAfter(
            Duration.millis(0),
            refs.internal.contentRelease.models.resume,
            {
              generation,
              releaseId,
            }
          );
    const updatedAt = yield* Clock.currentTimeMillis;
    yield* writer
      .table("contentModelBuilds")
      .patch(build._id, {
        cursor: progress.done ? undefined : cursor,
        itemIndex: itemIndex ?? (resetItems ? -1 : build.itemIndex),
        phase,
        syncJobId,
        updatedAt,
      })
      .pipe(Effect.orDie);
    return null;
  }
);

/** Restarts one failed lineage only while its observed fence still wins. */
export const restartModelBuild = Effect.fn("contentRelease.restartModelBuild")(
  function* (ctx: MutationCtx, args: ModelBuildRestartArgs) {
    const scheduler = yield* Scheduler.Scheduler.pipe(
      Effect.provide(Scheduler.layer(ctx.scheduler))
    );
    const writer = DatabaseWriter.make(databaseSchema, ctx.db);
    const build = yield* loadModelBuild(ctx);
    if (
      !build ||
      build.releaseId !== args.releaseId ||
      build.phase === "ready" ||
      build.generation !== args.expectedGeneration ||
      build.syncJobId !== args.expectedJobId
    ) {
      return {
        status: "stale",
      } satisfies ModelBuildRestartResult;
    }
    const job = yield* DatabaseReader.make(databaseSchema, ctx.db)
      .table("_scheduled_functions")
      .get(args.expectedJobId)
      .pipe(
        Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)),
        Effect.orDie
      );
    if (isRunningJob(job)) {
      return {
        status: "stale",
      } satisfies ModelBuildRestartResult;
    }
    const syncGeneration = args.expectedGeneration + 1;
    const syncJobId = yield* scheduler.runAfter(
      Duration.millis(0),
      refs.internal.contentRelease.models.resume,
      {
        generation: syncGeneration,
        releaseId: args.releaseId,
      }
    );
    const updatedAt = yield* Clock.currentTimeMillis;
    yield* writer
      .table("contentModelBuilds")
      .patch(build._id, {
        generation: syncGeneration,
        syncJobId,
        updatedAt,
      })
      .pipe(Effect.orDie);
    return {
      status: "restarted",
      syncGeneration,
      syncJobId,
    } satisfies ModelBuildRestartResult;
  }
);
