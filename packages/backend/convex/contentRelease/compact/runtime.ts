import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { Effect } from "effect";

/** Finds the earliest release still owned by a permanent try-out runtime. */
export const protectedRuntimeFloor = Effect.fn(
  "contentRelease.protectedRuntimeFloor"
)(function* (ctx: MutationCtx, releases: readonly Doc<"contentReleases">[]) {
  for (const release of releases) {
    const runtime = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutRuntimeBundles")
        .withIndex("by_sourceReleaseId", (query) =>
          query.eq("sourceReleaseId", release.releaseId)
        )
        .first()
    );
    if (runtime) {
      return release.sequence;
    }
  }
  return null;
});
