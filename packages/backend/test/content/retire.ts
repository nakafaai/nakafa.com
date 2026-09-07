import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import type { retirementHistoryValidator } from "@repo/backend/convex/contentRelease/retire/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { compactionIdentity } from "@repo/backend/test/content/compact";
import { testSignedRelease } from "@repo/backend/test/content/proof";
import {
  insertTestState,
  insertZeroRelease,
} from "@repo/backend/test/content/state";
import type { Infer } from "convex/values";

/** Seeds reviewed terminal records below a protected active release. */
export async function seedRetirementHistory(ctx: MutationCtx) {
  const releases: ReturnType<typeof compactionIdentity>[] = [];
  for (let sequence = 1; sequence <= 5; sequence += 1) {
    const identity = compactionIdentity(sequence);
    await insertZeroRelease(ctx, {
      ...identity,
      base: releases.at(-1),
      ownership: { base: [], result: ["material"] },
      role: "candidate",
      scope: { families: ["material"], snapshots: [] },
      status: "completed",
    });
    const row = await ctx.db
      .query("contentReleases")
      .withIndex("by_releaseId", (query) =>
        query.eq("releaseId", identity.releaseId)
      )
      .unique();
    if (!row) {
      throw new Error("Expected the technical retirement release.");
    }
    const parsed = await runConvexProgram(decodeReleaseJson(row.releaseJson));
    const signed = testSignedRelease(parsed.manifest);
    await ctx.db.patch("contentReleases", row._id, {
      createdAt: Date.now(),
      releaseJson: JSON.stringify(signed),
    });
    releases.push({ ...identity, manifestHash: signed.manifestHash });
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
  return { active, releases: releases.slice(0, 2) } satisfies Infer<
    typeof retirementHistoryValidator
  >;
}
