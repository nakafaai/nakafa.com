import { api } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { describe, expect, it } from "vitest";

const NOW = Date.parse("2026-01-01T00:00:00.000Z");

describe("contents/queries/recent", () => {
  it("returns recently viewed subjects through graph route projections", async () => {
    const t = createConvexTestWithBetterAuth();
    const seeded = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "recent-viewer",
      });
      const subjectId = await insertSubject(ctx, "viewed");
      const ref = await insertSubjectRoute(ctx, "viewed");

      await insertSubjectView(ctx, {
        lastViewedAt: NOW,
        suffix: "viewed",
        subjectId,
        userId: identity.userId,
      });

      return { ...identity, ref, subjectId };
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
        route: "subject/high-school/10/mathematics/topic-viewed/section-viewed",
        title: "Subject viewed",
        url: "https://nakafa.com/en/subject/high-school/10/mathematics/topic-viewed/section-viewed",
      }),
    ]);
    expect(results[0]).not.toHaveProperty("id");
    expect(results[0]).not.toHaveProperty("slug");
    expect(seeded.subjectId).not.toBe(seeded.ref.assetId);
  });

  it("drops recently viewed subjects without graph route projections", async () => {
    const t = createConvexTestWithBetterAuth();
    const identity = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "recent-missing-route",
      });
      const subjectId = await insertSubject(ctx, "missing-route");

      await insertSubjectView(ctx, {
        lastViewedAt: NOW,
        suffix: "missing-route",
        subjectId,
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

/** Inserts one subject section row for recently viewed query tests. */
async function insertSubject(ctx: MutationCtx, suffix: string) {
  const route = getSubjectRoute(suffix);
  const topicId = await ctx.db.insert("subjectTopics", {
    category: "high-school",
    grade: "10",
    locale: "en",
    material: "mathematics",
    order: 0,
    sectionCount: 1,
    slug: `subject/high-school/10/mathematics/topic-${suffix}`,
    syncedAt: NOW,
    title: `Topic ${suffix}`,
    topic: `topic-${suffix}`,
  });

  return await ctx.db.insert("subjectSections", {
    body: "Subject body",
    category: "high-school",
    contentHash: `subject-hash-${suffix}`,
    date: NOW,
    description: `Description ${suffix}`,
    grade: "10",
    locale: "en",
    material: "mathematics",
    order: 0,
    section: `section-${suffix}`,
    slug: route,
    subject: `Topic ${suffix}`,
    syncedAt: NOW,
    title: `Subject ${suffix}`,
    topic: `topic-${suffix}`,
    topicId,
  });
}

/** Inserts the route catalog graph projection for one subject section. */
async function insertSubjectRoute(ctx: MutationCtx, suffix: string) {
  const route = getSubjectRoute(suffix);
  const identity = createLearningGraphIdentityFromRoute({
    locale: "en",
    route,
  });

  if (!identity) {
    throw new Error(`Expected subject graph identity for ${route}.`);
  }

  await ctx.db.insert("contentRoutes", {
    ...identity,
    authors: [{ name: "Nakafa Author" }],
    contentHash: `subject-hash-${suffix}`,
    content_id: identity.assetId,
    date: NOW,
    description: `Description ${suffix}`,
    kind: "subject-section",
    locale: "en",
    markdown: true,
    route,
    section: "subject",
    syncedAt: NOW,
    title: `Subject ${suffix}`,
  });

  return identity;
}

/** Inserts one subject content-view row for the signed-in user. */
async function insertSubjectView(
  ctx: MutationCtx,
  {
    lastViewedAt,
    suffix,
    subjectId,
    userId,
  }: {
    lastViewedAt: number;
    suffix: string;
    subjectId: Id<"subjectSections">;
    userId: Id<"users">;
  }
) {
  await ctx.db.insert("contentViews", {
    contentRef: { id: subjectId, type: "subject" },
    deviceId: "device-recent",
    firstViewedAt: NOW,
    lastViewedAt,
    locale: "en",
    slug: getSubjectRoute(suffix),
    userId,
  });
}

/** Builds the canonical subject route used by recent-query fixtures. */
function getSubjectRoute(suffix: string) {
  return `subject/high-school/10/mathematics/topic-${suffix}/section-${suffix}`;
}
