import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { progressValidator } from "@repo/backend/convex/contentRelease/spec";
import { makeFunctionReference } from "convex/server";
import type { Infer } from "convex/values";
import { Effect } from "effect";

type ModelProgress = Infer<typeof progressValidator>;

const articleSyncReference = makeFunctionReference<
  "mutation",
  { releaseId: string },
  ModelProgress
>("contentRelease/article/sync:resume");

const searchSyncReference = makeFunctionReference<
  "mutation",
  { releaseId: string },
  ModelProgress
>("contentRelease/search/sync:resume");

/**
 * Durably starts both release-bound read-model synchronizers.
 *
 * Scheduling from the activation mutation is atomic with its pointer commit.
 * Each scheduled mutation persists one bounded page and schedules its own next
 * page, so an interrupted HTTP action cannot strand either model.
 */
export const scheduleReadModels = Effect.fn(
  "contentRelease.scheduleReadModels"
)(function* (ctx: MutationCtx, releaseId: string) {
  yield* Effect.promise(() =>
    ctx.scheduler.runAfter(0, searchSyncReference, { releaseId })
  );
  yield* Effect.promise(() =>
    ctx.scheduler.runAfter(0, articleSyncReference, { releaseId })
  );
});
