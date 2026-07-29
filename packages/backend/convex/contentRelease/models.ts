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
import { syncMaterials } from "@repo/backend/convex/contentRelease/material/sync";
import { syncSearch } from "@repo/backend/convex/contentRelease/search/sync";
import { loadSyncRelease } from "@repo/backend/convex/contentRelease/sync";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { makeFunctionReference, type SystemDataModel } from "convex/server";
import { type Infer, v } from "convex/values";
import { Effect } from "effect";

type ScheduledFunction = SystemDataModel["_scheduled_functions"]["document"];

export const readModelStatusValidator = v.object({
  phase: v.union(
    v.literal("completed"),
    v.literal("failed"),
    v.literal("syncing")
  ),
  releaseId: v.string(),
});
export type ReadModelStatus = Infer<typeof readModelStatusValidator>;

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
    material: ownsReadModel(
      release,
      signed,
      state.materialManifestHash,
      state.materialReleaseId,
      state.materialSequence
    ),
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
  const job = syncJobId
    ? yield* Effect.promise(() =>
        ctx.db.system.get("_scheduled_functions", syncJobId)
      )
    : null;
  return {
    phase: isRunningJob(job) ? "syncing" : "failed",
    releaseId,
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
 * Starts one serial read-model lineage or preserves its active generation.
 *
 * Scheduling occurs inside the activation transaction. A completed activation
 * retry reuses a pending lineage, restarts a failed lineage with a new
 * generation, and schedules nothing after all three model owners converge.
 */
export const scheduleReadModels = Effect.fn(
  "contentRelease.scheduleReadModels"
)(function* (ctx: MutationCtx, releaseId: string) {
  const { release, signed, state } = yield* loadSyncRelease(ctx, releaseId);
  if (hasCompletedReadModels(getReadModelOwnership(release, signed, state))) {
    return;
  }
  const existingJobId = release.syncJobId;
  const existingJob = existingJobId
    ? yield* Effect.promise(() =>
        ctx.db.system.get("_scheduled_functions", existingJobId)
      )
    : null;
  if (isRunningJob(existingJob)) {
    return;
  }
  const syncGeneration = (release.syncGeneration ?? 0) + 1;
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
