import { api } from "@repo/backend/convex/_generated/api";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { getDefaultPopularityWindow } from "@repo/backend/convex/contents/popularity";
import { learningPopularityRankings } from "@repo/backend/convex/contents/rankings";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import schema from "@repo/backend/convex/schema";
import { registerLearningPopularityAggregate } from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.parse("2026-01-01T00:00:00.000Z");
const canonicalContext = {
  contextKey: "canonical",
  contextMode: "canonical",
} as const;

/**
 * Builds the Convex test instance with the popularity ranking aggregate
 * registered, matching the production top-N query dependency.
 */
function createTrendingConvexTest() {
  const t = convexTest(schema, convexModules);
  registerLearningPopularityAggregate(t);
  return t;
}

/** Builds the public material route persisted in the popularity read model. */
function getPublicSubjectRoute(suffix: string) {
  return `subjects/mathematics/topic-${suffix}/section-${suffix}`;
}

/** Builds the authored source route that owns one graph asset identity. */
function getSourceSubjectRoute(suffix: string) {
  return `material/lesson/mathematics/topic-${suffix}/section-${suffix}`;
}

/** Inserts one ranked global popularity counter row for homepage queries. */
async function insertSubjectCounter(
  ctx: MutationCtx,
  input: {
    readonly currentSuffix?: string;
    readonly locale?: Locale;
    readonly materialDomain?: Doc<"learningPopularityCounters">["materialDomain"];
    readonly score: number;
    readonly suffix: string;
    readonly windowKey?: Doc<"learningPopularityCounters">["windowKey"];
  }
) {
  const locale = input.locale ?? "en";
  const sourcePath = getSourceSubjectRoute(input.suffix);
  const identity = createLearningGraphIdentityFromRoute({
    locale,
    route: sourcePath,
  });

  if (!identity) {
    expect.fail(`Expected subject graph identity for ${sourcePath}.`);
  }

  const currentSuffix = input.currentSuffix ?? input.suffix;

  await ctx.db.insert("contentRoutes", {
    ...identity,
    authors: [],
    contentHash: `route-hash-${input.suffix}`,
    content_id: identity.assetId,
    kind: "curriculum-lesson",
    locale,
    markdown: true,
    ...(input.materialDomain ? { materialDomain: input.materialDomain } : {}),
    route: getPublicSubjectRoute(currentSuffix),
    section: "material",
    sourcePath,
    syncedAt: NOW,
    title: `Subject ${currentSuffix}`,
  });

  const counterId = await ctx.db.insert("learningPopularityCounters", {
    ...identity,
    ...canonicalContext,
    content_id: identity.assetId,
    ...(input.materialDomain ? { materialDomain: input.materialDomain } : {}),
    locale,
    route: getPublicSubjectRoute(input.suffix),
    score: input.score,
    section: "material",
    scopeMode: "global",
    sourcePath,
    title: `Subject ${input.suffix}`,
    updatedAt: NOW,
    windowKey: input.windowKey ?? getDefaultPopularityWindow(),
  });
  const counter = await ctx.db.get(counterId);

  if (!counter) {
    expect.fail(`Expected popularity counter for ${sourcePath}.`);
  }

  await learningPopularityRankings.insert(ctx, counter);

  return identity;
}

describe("curriculumLessons/queries", () => {
  it("returns sorted subjects from the bounded windowed read model", async () => {
    const t = createTrendingConvexTest();
    const { firstRef, secondRef } = await t.mutation(async (ctx) => {
      const firstRef = await insertSubjectCounter(ctx, {
        materialDomain: "mathematics",
        score: 7,
        suffix: "first",
      });
      const secondRef = await insertSubjectCounter(ctx, {
        materialDomain: "mathematics",
        score: 10,
        suffix: "second",
      });
      await insertSubjectCounter(ctx, {
        locale: "id",
        materialDomain: "mathematics",
        score: 100,
        suffix: "ignored-locale",
      });

      return { firstRef, secondRef };
    });

    const results = await t.query(
      api.curriculumLessons.queries.getTrendingSubjects,
      {
        locale: "en",
        limit: 2,
        minViews: 5,
        windowKey: getDefaultPopularityWindow(),
      }
    );

    expect(results).toEqual([
      expect.objectContaining({
        assetId: secondRef.assetId,
        content_id: secondRef.assetId,
        contextKey: "canonical",
        href: "/subjects/mathematics/topic-second/section-second",
        materialDomain: "mathematics",
        route: "subjects/mathematics/topic-second/section-second",
        title: "Subject second",
        url: "https://nakafa.com/en/subjects/mathematics/topic-second/section-second",
        viewCount: 10,
      }),
      expect.objectContaining({
        assetId: firstRef.assetId,
        content_id: firstRef.assetId,
        contextKey: "canonical",
        href: "/subjects/mathematics/topic-first/section-first",
        materialDomain: "mathematics",
        route: "subjects/mathematics/topic-first/section-first",
        title: "Subject first",
        url: "https://nakafa.com/en/subjects/mathematics/topic-first/section-first",
        viewCount: 7,
      }),
    ]);
    expect(results[0]).not.toHaveProperty("id");
    expect(results[0]).not.toHaveProperty("slug");
  });

  it("returns an empty list when the caller asks for zero ranked cards", async () => {
    const t = createTrendingConvexTest();

    await t.mutation(async (ctx) => {
      await insertSubjectCounter(ctx, {
        materialDomain: "mathematics",
        score: 10,
        suffix: "zero-limit",
      });
    });

    const results = await t.query(
      api.curriculumLessons.queries.getTrendingSubjects,
      {
        locale: "en",
        limit: 0,
        windowKey: getDefaultPopularityWindow(),
      }
    );

    expect(results).toEqual([]);
  });

  it("keeps valid read-model rows even when old source lesson rows are absent", async () => {
    const t = createTrendingConvexTest();

    await t.mutation(async (ctx) => {
      await insertSubjectCounter(ctx, {
        materialDomain: "mathematics",
        score: 10,
        suffix: "source-free",
      });
    });

    const results = await t.query(
      api.curriculumLessons.queries.getTrendingSubjects,
      {
        locale: "en",
        minViews: 5,
        windowKey: getDefaultPopularityWindow(),
      }
    );

    expect(results).toEqual([
      expect.objectContaining({
        materialDomain: "mathematics",
        route: "subjects/mathematics/topic-source-free/section-source-free",
      }),
    ]);
  });

  it("hydrates stale counter routes from the current public route row", async () => {
    const t = createTrendingConvexTest();
    const { currentRef } = await t.mutation(async (ctx) => {
      const currentRef = await insertSubjectCounter(ctx, {
        currentSuffix: "current-route",
        materialDomain: "mathematics",
        score: 10,
        suffix: "stale-counter",
      });

      return { currentRef };
    });

    const results = await t.query(
      api.curriculumLessons.queries.getTrendingSubjects,
      {
        locale: "en",
        minViews: 5,
        windowKey: getDefaultPopularityWindow(),
      }
    );

    expect(results).toEqual([
      expect.objectContaining({
        assetId: currentRef.assetId,
        content_id: currentRef.assetId,
        href: "/subjects/mathematics/topic-current-route/section-current-route",
        route: "subjects/mathematics/topic-current-route/section-current-route",
        title: "Subject current-route",
        url: "https://nakafa.com/en/subjects/mathematics/topic-current-route/section-current-route",
      }),
    ]);
  });

  it("drops counter rows whose read-model projection lacks a material domain", async () => {
    const t = createTrendingConvexTest();

    await t.mutation(async (ctx) => {
      await insertSubjectCounter(ctx, {
        score: 10,
        suffix: "missing-domain",
      });
    });

    const results = await t.query(
      api.curriculumLessons.queries.getTrendingSubjects,
      {
        locale: "en",
        minViews: 5,
        windowKey: getDefaultPopularityWindow(),
      }
    );

    expect(results).toEqual([]);
  });

  it("drops practice counters from Trending Subjects cards", async () => {
    const t = createTrendingConvexTest();

    await t.mutation(async (ctx) => {
      await insertPracticeCounter(ctx, {
        materialDomain: "mathematics",
        score: 50,
        suffix: "practice",
      });
    });

    const results = await t.query(
      api.curriculumLessons.queries.getTrendingSubjects,
      {
        locale: "en",
        minViews: 5,
        windowKey: getDefaultPopularityWindow(),
      }
    );

    expect(results).toEqual([]);
  });
});

/** Inserts one ranked practice counter that must not hydrate as a subject. */
async function insertPracticeCounter(
  ctx: MutationCtx,
  input: {
    readonly materialDomain?: Doc<"learningPopularityCounters">["materialDomain"];
    readonly score: number;
    readonly suffix: string;
  }
) {
  const sourcePath = getSourcePracticeRoute(input.suffix);
  const identity = createLearningGraphIdentityFromRoute({
    locale: "en",
    route: sourcePath,
  });

  if (!identity) {
    expect.fail(`Expected practice graph identity for ${sourcePath}.`);
  }

  await ctx.db.insert("contentRoutes", {
    ...identity,
    authors: [],
    contentHash: `practice-route-hash-${input.suffix}`,
    content_id: identity.assetId,
    kind: "exercise-set",
    locale: "en",
    markdown: true,
    ...(input.materialDomain ? { materialDomain: input.materialDomain } : {}),
    route: getPublicPracticeRoute(input.suffix),
    section: "material",
    sourcePath,
    syncedAt: NOW,
    title: `Practice ${input.suffix}`,
  });

  const counterId = await ctx.db.insert("learningPopularityCounters", {
    ...identity,
    ...canonicalContext,
    content_id: identity.assetId,
    ...(input.materialDomain ? { materialDomain: input.materialDomain } : {}),
    locale: "en",
    route: getPublicPracticeRoute(input.suffix),
    score: input.score,
    section: "material",
    scopeMode: "global",
    sourcePath,
    title: `Practice ${input.suffix}`,
    updatedAt: NOW,
    windowKey: getDefaultPopularityWindow(),
  });
  const counter = await ctx.db.get(counterId);

  if (!counter) {
    expect.fail(`Expected popularity counter for ${sourcePath}.`);
  }

  await learningPopularityRankings.insert(ctx, counter);
}

/** Builds the authored source route for one practice counter fixture. */
function getSourcePracticeRoute(suffix: string) {
  return `material/practice/assessment/snbt/quantitative-knowledge/${suffix}/set-1`;
}

/** Builds the public route for one practice counter fixture. */
function getPublicPracticeRoute(suffix: string) {
  return `practice/assessment/snbt/quantitative-knowledge/${suffix}/set-1`;
}
