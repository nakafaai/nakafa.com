import { describe, expect, it, vi } from "@effect/vitest";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { loadSectionIrtSource } from "@repo/backend/convex/tryouts/runtime/irt/items";
import {
  createAttemptPlacements,
  loadAttemptPlacements,
} from "@repo/backend/convex/tryouts/runtime/placement";
import { TEST_RELEASE_ID } from "@repo/backend/test/content/release";
import {
  insertIrtScaleItem,
  insertTryoutAttempt,
  insertTryoutUser,
  tryoutSectionSnapshot,
} from "@repo/backend/test/tryout/runtime";
import {
  makeSignedTryoutSection,
  makeSignedTryoutSource,
} from "@repo/backend/test/tryout/section";
import { makeTryoutSection, makeTryoutSet } from "@repo/backend/test/tryouts";
import { convexTest } from "convex-test";

const NOW = Date.UTC(2026, 6, 7, 12, 0, 0);
type SourceCorruption = "duplicate" | "none" | "stale";
const corruptSourceCases: ReadonlyArray<{
  expectedCode: string;
  kind: SourceCorruption;
}> = [
  { expectedCode: "TRYOUT_IRT_ITEM_DUPLICATE", kind: "duplicate" },
  { expectedCode: "TRYOUT_IRT_ITEM_STALE", kind: "stale" },
];

/** Seeds one exact scale, attempt, and immutable placement inventory. */
async function seedSectionIrtSource(
  ctx: MutationCtx,
  corruption: SourceCorruption
) {
  const userId = await insertTryoutUser(ctx, {
    authId: `auth-irt-items-${corruption}`,
    email: `irt-items-${corruption}@example.com`,
    name: `IRT Items ${corruption}`,
  });
  const set = makeTryoutSet({ questionCount: 2 });
  const signedSection = makeSignedTryoutSection(
    makeTryoutSection({ questionCount: 2 })
  );
  const source = makeSignedTryoutSource(set, [signedSection]);
  const firstPlacement = signedSection.signed.placements[0];
  const secondPlacement = signedSection.signed.placements[1];
  if (!(firstPlacement && secondPlacement)) {
    throw new Error("Expected two signed IRT placement fixtures.");
  }
  const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
    model: "2pl",
    publishedAt: NOW,
    questionCount: 2,
    setIdentity: source.snapshot.setIdentity,
    status: "provisional",
    tryoutSnapshotId: source.snapshot.snapshotId,
  });
  const firstItemId = await insertIrtScaleItem(ctx, {
    placement: firstPlacement,
    scaleVersionId,
  });
  await insertIrtScaleItem(ctx, {
    placement: corruption === "duplicate" ? firstPlacement : secondPlacement,
    scaleVersionId,
  });
  if (corruption === "stale") {
    await ctx.db.patch(firstItemId, {
      placementRowHash: `${firstPlacement.rowHash}-stale`,
    });
  }

  const snapshot = tryoutSectionSnapshot({ signed: signedSection.signed });
  const attemptId = await insertTryoutAttempt(ctx, {
    scaleVersionId,
    sectionSnapshots: [snapshot],
    set,
    snapshotId: source.snapshot.snapshotId,
    snapshotReleaseId: TEST_RELEASE_ID,
    userId,
  });
  const attempt = await ctx.db.get(attemptId);
  if (!attempt) {
    throw new Error("Expected one active IRT attempt fixture.");
  }
  await runConvexProgram(createAttemptPlacements(ctx, { attempt, source }));

  return { attemptId, sectionIdentity: snapshot.sectionIdentity };
}

describe("tryouts/runtime/irt/items", () => {
  it("loads one section with two fixed indexed queries", async () => {
    const t = convexTest(schema, convexModules);
    const result = await t.mutation(async (ctx) => {
      const fixture = await seedSectionIrtSource(ctx, "none");
      const attempt = await ctx.db.get(fixture.attemptId);
      if (!attempt) {
        throw new Error("Expected one active IRT attempt fixture.");
      }
      const placements = await runConvexProgram(
        loadAttemptPlacements(ctx, attempt)
      );
      const query = vi.spyOn(ctx.db, "query");
      const source = await runConvexProgram(
        loadSectionIrtSource(ctx, {
          attempt,
          placements,
          sectionIdentity: fixture.sectionIdentity,
        })
      );
      const calibrationRunQueries = query.mock.calls.filter(
        ([tableName]) => tableName === "irtCalibrationRuns"
      ).length;
      const scaleItemQueries = query.mock.calls.filter(
        ([tableName]) => tableName === "irtScaleItems"
      ).length;
      query.mockRestore();

      return {
        calibrationRunQueries,
        itemCount: source.items.length,
        scaleItemQueries,
      };
    });

    expect(result).toEqual({
      calibrationRunQueries: 1,
      itemCount: 2,
      scaleItemQueries: 1,
    });
  });

  it.each(corruptSourceCases)(
    "rejects a $kind item source",
    async ({ expectedCode, kind }) => {
      const t = convexTest(schema, convexModules);
      const fixture = await t.mutation((ctx) =>
        seedSectionIrtSource(ctx, kind)
      );

      await expect(
        t.mutation(async (ctx) => {
          const attempt = await ctx.db.get(fixture.attemptId);
          if (!attempt) {
            throw new Error("Expected one active IRT attempt fixture.");
          }
          const placements = await runConvexProgram(
            loadAttemptPlacements(ctx, attempt)
          );
          return await runConvexProgram(
            loadSectionIrtSource(ctx, {
              attempt,
              placements,
              sectionIdentity: fixture.sectionIdentity,
            })
          );
        })
      ).rejects.toMatchObject({ data: { code: expectedCode } });
    }
  );
});
