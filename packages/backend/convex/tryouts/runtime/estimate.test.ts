import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { estimateIrtScore } from "@repo/backend/convex/tryouts/runtime/estimate";
import { describe, expect, it } from "@repo/testing/effect";
import { convexTest } from "convex-test";
import { Effect } from "effect";

type IrtScaleItem = Doc<"irtScaleItems">;

async function loadIrtItem() {
  const t = convexTest(schema, convexModules);
  return await t.mutation(async (ctx) => {
    const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
      model: "2pl",
      publishedAt: 1,
      questionCount: 1,
      setIdentity: "estimate-test-set",
      status: "provisional",
      tryoutSnapshotId: "estimate-test-snapshot",
    });
    const calibrationRunId = await ctx.db.insert("irtCalibrationRuns", {
      attemptCount: 0,
      completedAt: 1,
      iterationCount: 0,
      maxParameterDelta: 0,
      model: "2pl",
      questionCount: 1,
      responseCount: 0,
      scaleVersionId,
      sectionIdentity: "estimate-test-section",
      startedAt: 1,
      status: "completed",
      updatedAt: 1,
    });
    const itemId = await ctx.db.insert("irtScaleItems", {
      calibrationRunId,
      calibrationStatus: "provisional",
      correctRate: 0,
      difficulty: 0,
      discrimination: 1,
      placementIdentity: "estimate-test-placement",
      placementRowHash: "estimate-test-row",
      responseCount: 0,
      scaleVersionId,
    });
    const item = await ctx.db.get(itemId);
    if (!item) {
      throw new Error("Expected one IRT estimator item fixture.");
    }
    return item;
  });
}

describe("tryouts/runtime/estimate", () => {
  it.live.each([
    {
      kind: "non-positive discrimination",
      update: (item: IrtScaleItem) => ({ ...item, discrimination: 0 }),
    },
    {
      kind: "non-finite discrimination",
      update: (item: IrtScaleItem) => ({
        ...item,
        discrimination: Number.NaN,
      }),
    },
    {
      kind: "non-finite difficulty",
      update: (item: IrtScaleItem) => ({
        ...item,
        difficulty: Number.POSITIVE_INFINITY,
      }),
    },
    {
      kind: "overflowing finite discrimination",
      update: (item: IrtScaleItem) => ({
        ...item,
        discrimination: Number.MAX_VALUE,
      }),
    },
  ])("rejects $kind", ({ update }) =>
    Effect.gen(function* () {
      const item = update(yield* Effect.promise(() => loadIrtItem()));
      const error = yield* Effect.flip(
        estimateIrtScore([{ isCorrect: true, item }])
      );

      expect(error).toMatchObject({
        _tag: "TryoutRuntimeError",
        code: "TRYOUT_IRT_ITEM_INVALID",
      });
    })
  );
});
