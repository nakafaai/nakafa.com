import type { SignedContentRelease } from "@nakafa/aksara-contracts/release";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  internalMutation,
  internalQuery,
} from "@repo/backend/convex/_generated/server";
import { syncArticles } from "@repo/backend/convex/contentRelease/article/sync";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { hasMaterialReadModel } from "@repo/backend/convex/contentRelease/material/state";
import { syncMaterials } from "@repo/backend/convex/contentRelease/material/sync";
import { claimUnchangedReadModels } from "@repo/backend/convex/contentRelease/models/impact";
import { syncSearch } from "@repo/backend/convex/contentRelease/search/sync";
import { loadSyncRelease } from "@repo/backend/convex/contentRelease/sync";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference, type SystemDataModel } from "convex/server";
import { type Infer, v } from "convex/values";
import { Effect } from "effect";

type ScheduledFunction = SystemDataModel["_scheduled_functions"]["document"];

export const readModelStatusValidator = v.union(
  v.object({
    phase: v.literal("completed"),
    releaseId: v.string(),
  }),
  v.object({
    phase: v.union(v.literal("failed"), v.literal("syncing")),
    releaseId: v.string(),
    syncGeneration: v.number(),
    syncJobId: v.id("_scheduled_functions"),
  })
);
export type ReadModelStatus = Infer<typeof readModelStatusValidator>;

export const readModelRestartArgsValidator = v.object({
  expectedGeneration: v.number(),
  expectedJobId: v.id("_scheduled_functions"),
  releaseId: v.string(),
});
export type ReadModelRestartArgs = Infer<typeof readModelRestartArgsValidator>;

export const readModelRestartResultValidator = v.union(
  v.object({
    status: v.literal("restarted"),
    syncGeneration: v.number(),
    syncJobId: v.id("_scheduled_functions"),
  }),
  v.object({ status: v.literal("stale") })
);
export type ReadModelRestartResult = Infer<
  typeof readModelRestartResultValidator
>;

const resumeReference = makeFunctionReference<
  "mutation",
  { generation: number; releaseId: string },
  null
>("contentRelease/models:resume");

/** Matches one read-model owner against the active signed release identity. */
function ownsReadModel(
  release: Doc<"contentReleases">,
  signed: SignedContentRelease,
  manifestHash: string | undefined,
  releaseId: string | undefined,
  sequence: number | undefined
) {
  return (
    manifestHash === signed.manifestHash &&
    releaseId === release.releaseId &&
    sequence === release.sequence
  );
}

/** Derives exact read-model ownership from the active signed release. */
function getReadModelOwnership(
  release: Doc<"contentReleases">,
  signed: SignedContentRelease,
  state: Doc<"contentState">
) {
  return {
    article: ownsReadModel(
      release,
      signed,
      state.articleManifestHash,
      state.articleReleaseId,
      state.articleSequence
    ),
    material: hasMaterialReadModel({
      manifestHash: signed.manifestHash,
      releaseId: release.releaseId,
      sequence: release.sequence,
      state,
    }),
    search: ownsReadModel(
      release,
      signed,
      state.searchManifestHash,
      state.searchReleaseId,
      state.searchSequence
    ),
  };
}

/** Reports whether every public read model selects one exact active release. */
function hasCompletedReadModels(
  ownership: ReturnType<typeof getReadModelOwnership>
) {
  return ownership.article && ownership.material && ownership.search;
}

/** Reports whether one scheduled lineage can still make forward progress. */
function isRunningJob(job: ScheduledFunction | null) {
  return job?.state.kind === "pending" || job?.state.kind === "inProgress";
}

/** Advances exactly one model page in deterministic ownership order. */
const advanceNextModel = Effect.fn("contentRelease.advanceNextModel")(
  function* (
    ctx: MutationCtx,
    releaseId: string,
    ownership: ReturnType<typeof getReadModelOwnership>
  ) {
    if (!ownership.article) {
      return {
        model: "article",
        progress: yield* syncArticles(ctx, releaseId),
      };
    }
    if (!ownership.material) {
      return {
        model: "material",
        progress: yield* syncMaterials(ctx, releaseId),
      };
    }
    if (!ownership.search) {
      return {
        model: "search",
        progress: yield* syncSearch(ctx, releaseId),
      };
    }
    return null;
  }
);

/** Reads the durable state of one active release's serial model lineage. */
const readModelStatus = Effect.fn("contentRelease.readModelStatus")(function* (
  ctx: QueryCtx,
  releaseId: string
) {
  const { release, signed, state } = yield* loadSyncRelease(ctx, releaseId);
  const ownership = getReadModelOwnership(release, signed, state);
  if (hasCompletedReadModels(ownership)) {
    return {
      phase: "completed",
      releaseId,
    } satisfies ReadModelStatus;
  }
  const syncJobId = release.syncJobId;
  const syncGeneration = release.syncGeneration;
  if (syncGeneration === undefined || syncJobId === undefined) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Read-model sync ${releaseId} has no durable lineage identity.`
    );
  }
  const job = yield* Effect.promise(() =>
    ctx.db.system.get("_scheduled_functions", syncJobId)
  );
  return {
    phase: isRunningJob(job) ? "syncing" : "failed",
    releaseId,
    syncGeneration,
    syncJobId,
  } satisfies ReadModelStatus;
});

/** Executes one generation-fenced page and schedules its sole successor. */
const resumeReadModels = Effect.fn("contentRelease.resumeReadModels")(
  function* (ctx: MutationCtx, releaseId: string, generation: number) {
    const { release, signed, state } = yield* loadSyncRelease(ctx, releaseId);
    if (release.syncGeneration !== generation) {
      return null;
    }
    const ownership = getReadModelOwnership(release, signed, state);
    const advanced = yield* advanceNextModel(ctx, releaseId, ownership);
    if (!advanced) {
      return null;
    }
    if (!advanced.progress.done && advanced.progress.processed === 0) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `${advanced.model} sync ${releaseId} stopped without progress.`
      );
    }
    if (advanced.model === "search" && advanced.progress.done) {
      return null;
    }
    const syncJobId = yield* Effect.promise(() =>
      ctx.scheduler.runAfter(0, resumeReference, {
        generation,
        releaseId,
      })
    );
    yield* Effect.promise(() =>
      ctx.db.patch("contentReleases", release._id, {
        syncJobId,
        updatedAt: Date.now(),
      })
    );
    return null;
  }
);

/**
 * Claims unchanged models and starts one generation-1 lineage when needed.
 *
 * Scheduling and persisted identity are part of the same activation
 * transaction. Completed activation retries never call this program.
 */
export const startReadModels = Effect.fn("contentRelease.startReadModels")(
  function* (ctx: MutationCtx, releaseId: string) {
    const { release, signed, state } = yield* loadSyncRelease(ctx, releaseId);
    const claimedState = yield* claimUnchangedReadModels(
      ctx,
      release,
      signed,
      state
    );
    if (
      hasCompletedReadModels(
        getReadModelOwnership(release, signed, claimedState)
      )
    ) {
      return null;
    }
    const syncGeneration = 1;
    const syncJobId = yield* Effect.promise(() =>
      ctx.scheduler.runAfter(0, resumeReference, {
        generation: syncGeneration,
        releaseId,
      })
    );
    yield* Effect.promise(() =>
      ctx.db.patch("contentReleases", release._id, {
        syncGeneration,
        syncJobId,
        updatedAt: Date.now(),
      })
    );
    return { syncGeneration, syncJobId };
  }
);

/** Restarts one failed lineage only while its persisted identity still wins. */
const restartReadModels = Effect.fn("contentRelease.restartReadModels")(
  function* (ctx: MutationCtx, args: ReadModelRestartArgs) {
    const { release, signed, state } = yield* loadSyncRelease(
      ctx,
      args.releaseId
    );
    const ownership = getReadModelOwnership(release, signed, state);
    if (hasCompletedReadModels(ownership)) {
      return { status: "stale" } satisfies ReadModelRestartResult;
    }
    if (
      release.syncGeneration !== args.expectedGeneration ||
      release.syncJobId !== args.expectedJobId
    ) {
      return { status: "stale" } satisfies ReadModelRestartResult;
    }
    const job = yield* Effect.promise(() =>
      ctx.db.system.get("_scheduled_functions", args.expectedJobId)
    );
    if (isRunningJob(job)) {
      return { status: "stale" } satisfies ReadModelRestartResult;
    }
    const syncGeneration = args.expectedGeneration + 1;
    const syncJobId = yield* Effect.promise(() =>
      ctx.scheduler.runAfter(0, resumeReference, {
        generation: syncGeneration,
        releaseId: args.releaseId,
      })
    );
    yield* Effect.promise(() =>
      ctx.db.patch("contentReleases", release._id, {
        syncGeneration,
        syncJobId,
        updatedAt: Date.now(),
      })
    );
    return {
      status: "restarted",
      syncGeneration,
      syncJobId,
    } satisfies ReadModelRestartResult;
  }
);

/** Generation and job fenced recovery for one terminal failed lineage. */
export const restart = internalMutation({
  args: readModelRestartArgsValidator,
  returns: readModelRestartResultValidator,
  handler: (ctx, args) => runConvexProgram(restartReadModels(ctx, args)),
});

/** Internal read-only status used by the authenticated Node lifecycle action. */
export const status = internalQuery({
  args: { releaseId: v.string() },
  returns: readModelStatusValidator,
  handler: (ctx, { releaseId }) =>
    runConvexProgram(readModelStatus(ctx, releaseId)),
});

/** Internal serial coordinator scheduled atomically by release activation. */
export const resume = internalMutation({
  args: { generation: v.number(), releaseId: v.string() },
  returns: v.null(),
  handler: (ctx, { generation, releaseId }) =>
    runConvexProgram(resumeReadModels(ctx, releaseId, generation)),
});
