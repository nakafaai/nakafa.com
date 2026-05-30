import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  buildTryoutPartRouteMappings,
  resolveRequestedTryoutPart,
} from "@repo/backend/convex/tryouts/helpers/parts";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

async function insertExerciseSet(ctx: MutationCtx, suffix: string) {
  return await ctx.db.insert("exerciseSets", {
    locale: "id",
    slug: `exercises/high-school/snbt/quantitative-knowledge/try-out/2026/${suffix}`,
    category: "high-school",
    type: "snbt",
    material: "quantitative-knowledge",
    exerciseType: "try-out",
    setName: suffix,
    title: `Set ${suffix}`,
    questionCount: 10,
    syncedAt: 1,
  });
}

describe("tryouts/helpers/parts", () => {
  it("keeps current route keys one-to-one when a historical key moves and another key is renamed", async () => {
    const t = convexTest(schema, convexModules);
    const ids = await t.mutation(async (ctx) => ({
      firstSetId: await insertExerciseSet(ctx, "parts-first"),
      secondSetId: await insertExerciseSet(ctx, "parts-second"),
    }));

    const currentPartSets = [
      {
        partIndex: 0,
        partKey: "mathematical-reasoning",
      },
      {
        partIndex: 1,
        partKey: "verbal-reasoning",
      },
    ];
    const partSetSnapshots = [
      {
        partIndex: 0,
        partKey: "quantitative-knowledge",
        questionCount: 10,
        setId: ids.firstSetId,
      },
      {
        partIndex: 1,
        partKey: "mathematical-reasoning",
        questionCount: 10,
        setId: ids.secondSetId,
      },
    ];
    const { currentPartKeyBySnapshotIndex } = buildTryoutPartRouteMappings({
      currentPartSets,
      partSetSnapshots,
    });

    expect(currentPartKeyBySnapshotIndex.get(0)).toBe("verbal-reasoning");
    expect(currentPartKeyBySnapshotIndex.get(1)).toBe("mathematical-reasoning");
    expect(
      resolveRequestedTryoutPart({
        currentPartSets,
        partSetSnapshots,
        requestedPartKey: "verbal-reasoning",
      })?.snapshot.partIndex
    ).toBe(0);
    expect(
      resolveRequestedTryoutPart({
        currentPartSets,
        partSetSnapshots,
        requestedPartKey: "mathematical-reasoning",
      })?.snapshot.partIndex
    ).toBe(1);
    expect(
      resolveRequestedTryoutPart({
        currentPartSets,
        partSetSnapshots,
        requestedPartKey: "quantitative-knowledge",
      })
    ).toBeNull();
  });
});
