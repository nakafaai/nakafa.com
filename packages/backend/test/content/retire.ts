import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type {
  retirementAttemptValidator,
  retirementHistoryValidator,
} from "@repo/backend/convex/contentRelease/retire/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { writeTryoutSetProgress } from "@repo/backend/convex/tryouts/progress/write";
import { compactionIdentity } from "@repo/backend/test/content/compact";
import {
  insertTestState,
  insertZeroRelease,
} from "@repo/backend/test/content/state";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import type { Infer } from "convex/values";

/** Seeds reviewed recent predecessor records below a modern active release. */
export async function seedRetirementHistory(ctx: MutationCtx) {
  const releases = Array.from({ length: 5 }, (_, index) =>
    compactionIdentity(index + 1)
  );
  for (const [index, identity] of releases.entries()) {
    await insertZeroRelease(ctx, {
      ...identity,
      base: releases[index - 1],
      ownership: { base: [], result: ["material"] },
      role: "candidate",
      scope:
        index < 3
          ? { content: [], families: ["material"], snapshots: [] }
          : { families: ["material"], snapshots: [] },
      status: "completed",
    });
  }
  const active = releases.at(-1);
  if (!active) {
    throw new Error("Expected the technical active release fixture.");
  }
  await insertTestState(ctx, { active, nextSequence: 6 });
  const state = await ctx.db.query("contentState").unique();
  if (!state) {
    throw new Error("Expected the technical singleton fixture.");
  }
  await ctx.db.patch("contentState", state._id, { compactedFloor: 1 });
  return { active, releases: releases.slice(0, 3) } satisfies Infer<
    typeof retirementHistoryValidator
  >;
}

/** Seeds one unpaid completed attempt isolated from current publication state. */
export async function seedRetirementAttempt(ctx: MutationCtx) {
  const fixture = await seedTryoutContentAccessState(ctx, {
    attemptStatus: "completed",
    sectionStatus: "completed",
    suffix: "retirement",
  });
  const state = await ctx.db.query("contentState").unique();
  if (state) {
    const original = await ctx.db
      .query("contentReleases")
      .withIndex("by_releaseId", (q) =>
        q.eq("releaseId", state.activeReleaseId ?? "")
      )
      .unique();
    if (original) {
      await ctx.db.delete("contentReleases", original._id);
    }
    await ctx.db.delete("contentState", state._id);
  }
  const history = await seedRetirementHistory(ctx);
  const source = history.releases[0];
  const attempt = await ctx.db.get("tryoutAttempts", fixture.attemptId);
  if (!(source && attempt)) {
    throw new Error("Expected the technical retirement source and attempt.");
  }
  await ctx.db.patch("tryoutRuntimeBundles", attempt.tryoutBundleId, {
    cleanupReleaseId: undefined,
    sourceManifestHash: source.manifestHash,
    sourceReleaseId: source.releaseId,
  });
  await ctx.db.patch("tryoutAttempts", attempt._id, {
    snapshotReleaseId: source.releaseId,
  });
  await runConvexProgram(
    writeTryoutSetProgress(ctx, {
      attempt,
      publishedScore: 100,
      status: "completed",
      updatedAt: attempt.lastActivityAt,
    })
  );
  return {
    attemptId: attempt._id,
    bundleHash: attempt.tryoutBundleHash,
    runtimeId: attempt.tryoutBundleId,
    source,
    startedAt: attempt.startedAt,
  } satisfies Infer<typeof retirementAttemptValidator>;
}
