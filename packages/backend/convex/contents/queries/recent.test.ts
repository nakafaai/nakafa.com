import { api } from "@repo/backend/convex/_generated/api";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { describe, expect, it } from "vitest";

const NOW = Date.parse("2026-01-01T00:00:00.000Z");
const canonicalContext = {
  contextKey: "canonical",
  contextMode: "canonical",
} as const;

describe("contents/queries/recent", () => {
  it("returns recently viewed materials through graph route projections", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "recent-viewer",
      });
      const lessonId = await insertCurriculumLesson(ctx, "viewed");
      const ref = await insertMaterialRoute(ctx, "viewed");

      await insertMaterialRecent(ctx, {
        ref,
        lastViewedAt: NOW,
        materialDomain: "mathematics",
        suffix: "viewed",
        userId: identity.userId,
      });

      return { ...identity, lessonId, ref };
    });

    const results = await t
      .withIdentity({
        sessionId: seeded.sessionId,
        subject: seeded.authUserId,
      })
      .query(api.contents.queries.recent.getRecentlyViewed, {
        locale: "en",
        limit: 5,
      });

    expect(results).toEqual([
      expect.objectContaining({
        assetId: seeded.ref.assetId,
        content_id: seeded.ref.assetId,
        lastViewedAt: NOW,
        materialDomain: "mathematics",
        route: "subjects/mathematics/topic-viewed/section-viewed",
        title: "Material viewed",
        url: "https://nakafa.com/en/subjects/mathematics/topic-viewed/section-viewed",
      }),
    ]);
    expect(results[0]).not.toHaveProperty("id");
    expect(results[0]).not.toHaveProperty("slug");
    expect(seeded.lessonId).not.toBe(seeded.ref.assetId);
  });

  it("drops recently viewed materials without material-domain projection", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "recent-missing-domain",
      });
      const ref = getMaterialGraph("missing-domain");

      await insertMaterialRecent(ctx, {
        ref,
        lastViewedAt: NOW,
        suffix: "missing-domain",
        userId: identity.userId,
      });

      return identity;
    });

    const results = await t
      .withIdentity({
        sessionId: identity.sessionId,
        subject: identity.authUserId,
      })
      .query(api.contents.queries.recent.getRecentlyViewed, {
        locale: "en",
        limit: 5,
      });

    expect(results).toEqual([]);
  });

  it("uses the current route projection when a recent row has stale route copy", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "recent-stale-route",
      });
      const ref = await insertMaterialRoute(ctx, "stale-route");

      await insertMaterialRecent(ctx, {
        ref,
        lastViewedAt: NOW,
        materialDomain: "mathematics",
        suffix: "stale-route",
        userId: identity.userId,
      });

      const route = await ctx.db
        .query("contentRoutes")
        .withIndex("by_content_id", (q) => q.eq("content_id", ref.assetId))
        .unique();

      if (!route) {
        expect.fail("Expected content route for stale recent fixture.");
      }

      await ctx.db.patch(route._id, {
        route: "subjects/mathematics/topic-current/section-current",
        title: "Material current",
      });

      return { ...identity, ref };
    });

    const results = await t
      .withIdentity({
        sessionId: seeded.sessionId,
        subject: seeded.authUserId,
      })
      .query(api.contents.queries.recent.getRecentlyViewed, {
        locale: "en",
        limit: 5,
      });

    expect(results).toEqual([
      expect.objectContaining({
        href: "/subjects/mathematics/topic-current/section-current",
        route: "subjects/mathematics/topic-current/section-current",
        title: "Material current",
      }),
    ]);
  });

  it("drops practice recents from material Continue Learning cards", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "recent-practice",
      });
      const ref = await insertPracticeRoute(ctx, "recent-practice");

      await insertMaterialRecent(ctx, {
        ref,
        lastViewedAt: NOW,
        materialDomain: "mathematics",
        suffix: "recent-practice",
        userId: identity.userId,
      });

      return identity;
    });

    const results = await t
      .withIdentity({
        sessionId: identity.sessionId,
        subject: identity.authUserId,
      })
      .query(api.contents.queries.recent.getRecentlyViewed, {
        locale: "en",
        limit: 5,
      });

    expect(results).toEqual([]);
  });
});

/** Inserts one curriculum lesson row for recently viewed query tests. */
async function insertCurriculumLesson(ctx: MutationCtx, suffix: string) {
  const route = getMaterialLessonRoute(suffix);
  const topicId = await ctx.db.insert("curriculumTopics", {
    locale: "en",
    material: "mathematics",
    order: 0,
    sectionCount: 1,
    slug: `material/lesson/mathematics/topic-${suffix}`,
    syncedAt: NOW,
    title: `Topic ${suffix}`,
    topic: `topic-${suffix}`,
  });

  return await ctx.db.insert("curriculumLessons", {
    body: "Material body",
    contentHash: `material-hash-${suffix}`,
    date: NOW,
    description: `Description ${suffix}`,
    locale: "en",
    material: "mathematics",
    order: 0,
    section: `section-${suffix}`,
    slug: route,
    subject: `Topic ${suffix}`,
    syncedAt: NOW,
    title: `Material ${suffix}`,
    topic: `topic-${suffix}`,
    topicId,
  });
}

/** Inserts the route catalog graph projection for one curriculum lesson. */
async function insertMaterialRoute(ctx: MutationCtx, suffix: string) {
  const route = getMaterialLessonRoute(suffix);
  const identity = getMaterialGraph(suffix);

  await ctx.db.insert("contentRoutes", {
    ...identity,
    authors: [{ name: "Nakafa Author" }],
    contentHash: `material-hash-${suffix}`,
    content_id: identity.assetId,
    date: NOW,
    description: `Description ${suffix}`,
    kind: "curriculum-lesson",
    locale: "en",
    markdown: true,
    materialDomain: "mathematics",
    route: getPublicMaterialLessonRoute(suffix),
    section: "material",
    sourcePath: route,
    syncedAt: NOW,
    title: `Material ${suffix}`,
  });

  return identity;
}

/** Inserts the route catalog graph projection for one practice set. */
async function insertPracticeRoute(ctx: MutationCtx, suffix: string) {
  const route = getPracticeSetRoute(suffix);
  const identity = createLearningGraphIdentityFromRoute({
    locale: "en",
    route,
  });

  if (!identity) {
    expect.fail(`Expected practice graph identity for ${route}.`);
  }

  await ctx.db.insert("contentRoutes", {
    ...identity,
    authors: [{ name: "Nakafa Author" }],
    contentHash: `practice-hash-${suffix}`,
    content_id: identity.assetId,
    date: NOW,
    description: `Practice ${suffix}`,
    kind: "exercise-set",
    locale: "en",
    markdown: true,
    materialDomain: "mathematics",
    route: getPublicPracticeSetRoute(suffix),
    section: "material",
    sourcePath: route,
    syncedAt: NOW,
    title: `Practice ${suffix}`,
  });

  return identity;
}

/** Inserts one signed-in Continue Learning read-model row. */
async function insertMaterialRecent(
  ctx: MutationCtx,
  {
    ref,
    lastViewedAt,
    materialDomain,
    suffix,
    userId,
  }: {
    ref: ReturnType<typeof getMaterialGraph>;
    lastViewedAt: number;
    materialDomain?: Doc<"userLearningRecents">["materialDomain"];
    suffix: string;
    userId: Id<"users">;
  }
) {
  await ctx.db.insert("userLearningRecents", {
    ...ref,
    ...canonicalContext,
    content_id: ref.assetId,
    description: `Description ${suffix}`,
    lastViewedAt,
    locale: "en",
    ...(materialDomain ? { materialDomain } : {}),
    route: getPublicMaterialLessonRoute(suffix),
    section: "material",
    sourcePath: getMaterialLessonRoute(suffix),
    title: `Material ${suffix}`,
    userId,
  });
}

/** Builds the route-catalog graph identity for one material fixture. */
function getMaterialGraph(suffix: string) {
  const route = getMaterialLessonRoute(suffix);
  const identity = createLearningGraphIdentityFromRoute({
    locale: "en",
    route,
  });

  if (!identity) {
    expect.fail(`Expected material graph identity for ${route}.`);
  }

  return identity;
}

/** Builds the canonical material route used by recent-query fixtures. */
function getMaterialLessonRoute(suffix: string) {
  return `material/lesson/mathematics/topic-${suffix}/section-${suffix}`;
}

/** Builds the public material route used by recent-query route projections. */
function getPublicMaterialLessonRoute(suffix: string) {
  return `subjects/mathematics/topic-${suffix}/section-${suffix}`;
}

/** Builds the canonical practice route used by stale recent fixtures. */
function getPracticeSetRoute(suffix: string) {
  return `material/practice/assessment/snbt/quantitative-knowledge/${suffix}/set-1`;
}

/** Builds the public practice route used by stale recent fixtures. */
function getPublicPracticeSetRoute(suffix: string) {
  return `practice/assessment/snbt/quantitative-knowledge/${suffix}/set-1`;
}
