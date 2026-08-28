import { describe, expect, it } from "@effect/vitest";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import {
  type MaterialLessonProjection,
  MaterialLessonProjectionSchema,
} from "@nakafa/aksara-contracts/projection/material";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { getDefaultPopularityWindow } from "@repo/backend/convex/contents/popularity";
import { learningPopularityRankings } from "@repo/backend/convex/contents/rankings";
import type {
  GetTrendingSubjectsArgs,
  GetTrendingSubjectsResult,
} from "@repo/backend/convex/contents/trending/spec";
import schema from "@repo/backend/convex/schema";
import { registerLearningPopularityAggregate } from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import { activateMaterialCatalog } from "@repo/backend/test/material/catalog";
import type { Locale } from "@repo/contents/_types/content";
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";

const NOW = Date.parse("2026-01-01T00:00:00.000Z");
const canonicalContext = {
  contextKey: "canonical",
  contextMode: "canonical",
} as const;
const getTrendingSubjects = makeFunctionReference<
  "query",
  GetTrendingSubjectsArgs,
  GetTrendingSubjectsResult
>("contents/queries/trending:getTrendingSubjects");

/** Builds a Convex test with the production popularity aggregate registered. */
function createTrendingConvexTest() {
  const target = convexTest(schema, convexModules);
  registerLearningPopularityAggregate(target);
  return target;
}

/** Inserts one ranked counter whose copied presentation is deliberately stale. */
async function insertMaterialCounter(
  ctx: MutationCtx,
  projection: MaterialLessonProjection,
  locale: Locale,
  score: number
) {
  const counterId = await ctx.db.insert("learningPopularityCounters", {
    ...projection.graph,
    ...canonicalContext,
    content_id: projection.graph.assetId,
    description: "Stale copied description",
    locale,
    materialDomain: "biology",
    route: projection.publicPath,
    score,
    section: "material",
    scopeMode: "global",
    sourcePath: "stale/copied/source",
    title: "Stale copied title",
    updatedAt: NOW,
    windowKey: getDefaultPopularityWindow(),
  });
  const counter = await ctx.db.get(counterId);
  if (!counter) {
    throw new Error("Expected one current popularity counter fixture.");
  }
  await learningPopularityRankings.insert(ctx, counter);
}

describe("contents/queries/trending", () => {
  it("returns ranked cards hydrated from current signed materials", async () => {
    const first = makeMaterialProjection("en", 1, 20);
    const second = makeMaterialProjection("en", 2, 21);
    const ignoredLocale = makeMaterialProjection("id", 1, 20);
    const target = createTrendingConvexTest();
    await activateMaterialCatalog(target, [first, second, ignoredLocale]);
    await target.mutation(async (ctx) => {
      await insertMaterialCounter(ctx, first, "en", 7);
      await insertMaterialCounter(ctx, second, "en", 10);
      await insertMaterialCounter(ctx, ignoredLocale, "id", 100);
    });

    const results = await target.query(getTrendingSubjects, {
      locale: "en",
      limit: 2,
      minViews: 5,
      windowKey: getDefaultPopularityWindow(),
    });

    expect(results).toEqual([
      expect.objectContaining({
        assetId: second.graph.assetId,
        content_id: second.graph.assetId,
        contextKey: "canonical",
        description: "",
        href: `/${second.publicPath}`,
        materialDomain: "mathematics",
        route: second.publicPath,
        title: second.metadata.title,
        url: `https://nakafa.com/en/${second.publicPath}`,
        viewCount: 10,
      }),
      expect.objectContaining({
        assetId: first.graph.assetId,
        content_id: first.graph.assetId,
        contextKey: "canonical",
        href: `/${first.publicPath}`,
        materialDomain: "mathematics",
        route: first.publicPath,
        title: first.metadata.title,
        viewCount: 7,
      }),
    ]);
    expect(results[0]).not.toHaveProperty("id");
    expect(results[0]).not.toHaveProperty("slug");
  });

  it("pages past a missing ranking and preserves a renamed material", async () => {
    const missing = makeMaterialProjection("en", 1, 30);
    const previous = makeMaterialProjection("en", 2, 31);
    const current = MaterialLessonProjectionSchema.make({
      ...previous,
      parentPath: PublicPathSchema.make(
        "subjects/mathematics/renamed-technical-topic"
      ),
      publicPath: PublicPathSchema.make(
        "subjects/mathematics/renamed-technical-topic/section-2"
      ),
    });
    const target = createTrendingConvexTest();
    await activateMaterialCatalog(target, [current]);
    await target.mutation(async (ctx) => {
      await insertMaterialCounter(ctx, missing, "en", 100);
      await insertMaterialCounter(ctx, previous, "en", 10);
    });

    const results = await target.query(getTrendingSubjects, {
      locale: "en",
      limit: 1,
      minViews: 5,
      windowKey: getDefaultPopularityWindow(),
    });

    expect(results).toEqual([
      expect.objectContaining({
        assetId: current.graph.assetId,
        route: current.publicPath,
        title: current.metadata.title,
      }),
    ]);
  });

  it("returns no cards for a zero result limit", async () => {
    const target = createTrendingConvexTest();

    await expect(
      target.query(getTrendingSubjects, {
        locale: "en",
        limit: 0,
        windowKey: getDefaultPopularityWindow(),
      })
    ).resolves.toEqual([]);
  });
});
