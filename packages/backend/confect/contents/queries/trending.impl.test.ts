import {
  DatabaseReader as ConfectDatabaseReader,
  RegisteredConvexFunction,
} from "@confect/server";
import { afterEach, describe, expect, it } from "@effect/vitest";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import {
  type MaterialLessonProjection,
  MaterialLessonProjectionSchema,
} from "@nakafa/aksara-contracts/projection/material";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { QueryCtx as QueryCtxService } from "@repo/backend/confect/_generated/services";
import { getDefaultPopularityWindow } from "@repo/backend/confect/contents/popularity";
import { learningPopularityRankings } from "@repo/backend/confect/contents/rankings";
import { listTrendingSubjects } from "@repo/backend/confect/contents/trending/impl";
import { registerLearningPopularityAggregate } from "@repo/backend/confect/test.helpers";
import { convexModules } from "@repo/backend/confect/test.setup";
import { api } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import { activateMaterialCatalog } from "@repo/backend/test/material/catalog";
import type { Locale } from "@repo/contents/content";
import { convexTest } from "convex-test";
import { Data, Effect } from "effect";

class TrendingStorageUnavailable extends Data.TaggedError(
  "TrendingStorageUnavailable"
)<{
  readonly message: string;
}> {}
afterEach(() => vi.restoreAllMocks());
const NOW = Date.parse("2026-01-01T00:00:00.000Z");
const canonicalContext = {
  contextKey: "canonical",
  contextMode: "canonical",
} as const;
const getTrendingSubjects = api.contents.queries.trending.getTrendingSubjects;

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
    latestDay: NOW,
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
  return counterId;
}
describe("contents/queries/trending", () => {
  it("reports a typed error when ranked popularity storage is unavailable", async () => {
    const t = createTrendingConvexTest();
    vi.spyOn(learningPopularityRankings, "paginate").mockRejectedValueOnce(
      new TrendingStorageUnavailable({
        message: "ranking unavailable",
      })
    );
    await expect(
      t.query(getTrendingSubjects, {
        locale: "en",
      })
    ).rejects.toMatchObject({
      data: {
        code: "TRENDING_SUBJECT_IO_FAILED",
        message: "Unable to load trending subjects.",
      },
    });
  });
  it("fails without returning partial cards when a ranked counter cannot be read", async () => {
    const t = createTrendingConvexTest();
    const projection = makeMaterialProjection("en", 1, 30);
    await t.mutation((ctx) =>
      Effect.runPromise(
        activateMaterialCatalog([projection]).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    await t.mutation((ctx) => insertMaterialCounter(ctx, projection, "en", 10));
    await expect(
      t.query((ctx) => {
        vi.spyOn(ctx.db, "get").mockRejectedValueOnce(
          new TrendingStorageUnavailable({
            message: "counter unavailable",
          })
        );
        return Effect.runPromise(
          listTrendingSubjects({
            locale: "en",
          }).pipe(
            Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db)),
            Effect.provideService(QueryCtxService, ctx)
          )
        );
      })
    ).rejects.toMatchObject({
      code: "TRENDING_SUBJECT_IO_FAILED",
      message: "Unable to load trending subjects.",
    });
  });
  it("skips lost aggregate targets and counters below the view threshold", async () => {
    const stale = makeMaterialProjection("en", 1, 30);
    const popular = makeMaterialProjection("en", 2, 31);
    const quiet = makeMaterialProjection("en", 3, 32);
    const target = createTrendingConvexTest();
    await target.mutation((ctx) =>
      Effect.runPromise(
        activateMaterialCatalog([stale, popular, quiet]).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    await target.mutation(async (ctx) => {
      const staleId = await insertMaterialCounter(ctx, stale, "en", 100);
      await insertMaterialCounter(ctx, popular, "en", 10);
      await insertMaterialCounter(ctx, quiet, "en", 4);
      await ctx.db.delete("learningPopularityCounters", staleId);
    });
    await expect(
      target.query(getTrendingSubjects, {
        locale: "en",
      })
    ).resolves.toMatchObject([
      {
        content_id: popular.graph.assetId,
        viewCount: 10,
      },
    ]);
  });
  it("returns ranked cards hydrated from current signed materials", async () => {
    const first = makeMaterialProjection("en", 1, 20);
    const second = makeMaterialProjection("en", 2, 21);
    const ignoredLocale = makeMaterialProjection("id", 1, 20);
    const target = createTrendingConvexTest();
    await target.mutation((ctx) =>
      Effect.runPromise(
        activateMaterialCatalog([first, second, ignoredLocale]).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
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
    await target.mutation((ctx) =>
      Effect.runPromise(
        activateMaterialCatalog([current]).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
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
