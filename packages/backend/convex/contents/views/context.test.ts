import { api } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const NOW = Date.UTC(2026, 6, 13, 2, 0, 0);
const SOURCE_PATH = "material/lesson/biology/biodiversity/bacteria";
const PUBLIC_TOPIC_PATH = "materi/biologi/keanekaragaman-makhluk-hidup";
const PUBLIC_LESSON_PATH = `${PUBLIC_TOPIC_PATH}/bakteri`;
const MATERIAL_KEY = "lesson.biology.biodiversity";
const PROGRAM_KEY = "cambridge-international";
const CONTEXT_NODE_KEY = "biology-0610-living-organisms";
const CONTEXT_PUBLIC_PATH =
  "kurikulum/cambridge-international/upper-secondary/biology-0610/karakteristik-dan-klasifikasi-organisme-hidup";
const CONTEXT_PARENT_PATH =
  "kurikulum/cambridge-international/upper-secondary/biology-0610";

/** Inserts one production-shaped material route and its exact placement leaf. */
async function seedMaterialPlacement(ctx: MutationCtx) {
  const identity = createLearningGraphIdentityFromRoute({
    locale: "id",
    route: SOURCE_PATH,
  });

  if (!identity) {
    expect.fail(`Expected graph identity for ${SOURCE_PATH}.`);
  }

  await ctx.db.insert("contentRoutes", {
    ...identity,
    authors: [],
    contentHash: "content-route-hash",
    content_id: identity.assetId,
    description: "Mengenali bakteri",
    kind: "curriculum-lesson",
    locale: "id",
    markdown: true,
    materialDomain: "biology",
    route: PUBLIC_LESSON_PATH,
    section: "material",
    sourcePath: SOURCE_PATH,
    syncedAt: NOW,
    title: "Bakteri",
  });

  await ctx.db.insert("publicRoutes", {
    contentHash: "public-material-route-hash",
    kind: "subject-lesson",
    locale: "id",
    materialDomain: "biology",
    materialKey: MATERIAL_KEY,
    parentPath: PUBLIC_TOPIC_PATH,
    publicPath: PUBLIC_LESSON_PATH,
    sitemap: true,
    sourcePath: SOURCE_PATH,
    syncShard: 0,
    title: "Bakteri",
  });

  const placementId = await ctx.db.insert("publicRoutes", {
    canonicalPath: PUBLIC_TOPIC_PATH,
    contentHash: "curriculum-placement-route-hash",
    kind: "curriculum-context",
    locale: "id",
    materialContextNodeKey: CONTEXT_NODE_KEY,
    materialContextParentPath: CONTEXT_PARENT_PATH,
    materialContextPublicPath: CONTEXT_PUBLIC_PATH,
    materialKey: MATERIAL_KEY,
    nodeKey: `${CONTEXT_NODE_KEY}-material`,
    parentPath: CONTEXT_PUBLIC_PATH,
    programKey: PROGRAM_KEY,
    publicPath: `${CONTEXT_PUBLIC_PATH}/bakteri`,
    sitemap: false,
    syncShard: 0,
    title: "Bakteri",
  });

  const viewer = await seedAuthenticatedUser(ctx, {
    now: NOW,
    suffix: "material-context",
  });

  return { ...viewer, contentId: identity.assetId, placementId };
}

describe("contents/views/context", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("persists and resumes an exact curriculum placement", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation(seedMaterialPlacement);
    const signedIn = t.withIdentity({
      sessionId: fixture.sessionId,
      subject: fixture.authUserId,
    });

    await signedIn.mutation(api.contents.mutations.views.recordContentView, {
      contentId: fixture.contentId,
      context: {
        mode: "placement",
        nodeKey: CONTEXT_NODE_KEY,
        programKey: PROGRAM_KEY,
      },
      deviceId: "context-device",
      locale: "id",
    });

    const state = await t.query(async (ctx) => ({
      recents: await ctx.db.query("userLearningRecents").collect(),
      views: await ctx.db.query("learningViews").collect(),
    }));
    const results = await signedIn.query(
      api.contents.queries.recent.getRecentlyViewed,
      { locale: "id", limit: 5 }
    );

    expect(state.views).toMatchObject([
      {
        contextKey: `placement:${PROGRAM_KEY}:${CONTEXT_NODE_KEY}`,
        contextMode: "placement",
        contextNodeKey: CONTEXT_NODE_KEY,
      },
    ]);
    expect(state.recents).toMatchObject([
      {
        contextParentPath: CONTEXT_PARENT_PATH,
        contextProgramKey: PROGRAM_KEY,
        contextPublicPath: CONTEXT_PUBLIC_PATH,
      },
    ]);
    expect(results).toMatchObject([
      {
        contextKey: `placement:${PROGRAM_KEY}:${CONTEXT_NODE_KEY}`,
        href: `/${PUBLIC_LESSON_PATH}?ctx=${PROGRAM_KEY}~${CONTEXT_NODE_KEY}`,
      },
    ]);
  });

  it("keeps a later direct visit canonical", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation(seedMaterialPlacement);
    const signedIn = t.withIdentity({
      sessionId: fixture.sessionId,
      subject: fixture.authUserId,
    });

    await signedIn.mutation(api.contents.mutations.views.recordContentView, {
      contentId: fixture.contentId,
      context: {
        mode: "placement",
        nodeKey: CONTEXT_NODE_KEY,
        programKey: PROGRAM_KEY,
      },
      deviceId: "placement-device",
      locale: "id",
    });
    vi.setSystemTime(NOW + 1000);
    await signedIn.mutation(api.contents.mutations.views.recordContentView, {
      contentId: fixture.contentId,
      deviceId: "direct-device",
      locale: "id",
    });

    const results = await signedIn.query(
      api.contents.queries.recent.getRecentlyViewed,
      { locale: "id", limit: 5 }
    );

    expect(results).toMatchObject([
      {
        contextKey: "canonical",
        href: `/${PUBLIC_LESSON_PATH}`,
      },
    ]);
  });

  it("stores an unverified client placement as canonical context", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation(seedMaterialPlacement);
    const signedIn = t.withIdentity({
      sessionId: fixture.sessionId,
      subject: fixture.authUserId,
    });

    await signedIn.mutation(api.contents.mutations.views.recordContentView, {
      contentId: fixture.contentId,
      context: {
        mode: "placement",
        nodeKey: CONTEXT_NODE_KEY,
        programKey: "merdeka",
      },
      deviceId: "unverified-context-device",
      locale: "id",
    });

    const state = await t.query(async (ctx) => ({
      recents: await ctx.db.query("userLearningRecents").collect(),
      views: await ctx.db.query("learningViews").collect(),
    }));
    const results = await signedIn.query(
      api.contents.queries.recent.getRecentlyViewed,
      { locale: "id", limit: 5 }
    );

    expect(state.views).toMatchObject([
      { contextKey: "canonical", contextMode: "canonical" },
    ]);
    expect(state.recents).toMatchObject([
      { contextKey: "canonical", contextMode: "canonical" },
    ]);
    expect(results).toMatchObject([
      {
        contextKey: "canonical",
        href: `/${PUBLIC_LESSON_PATH}`,
      },
    ]);
  });

  it("drops a stored placement when the current projection no longer owns it", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixture = await t.mutation(seedMaterialPlacement);
    const signedIn = t.withIdentity({
      sessionId: fixture.sessionId,
      subject: fixture.authUserId,
    });

    await signedIn.mutation(api.contents.mutations.views.recordContentView, {
      contentId: fixture.contentId,
      context: {
        mode: "placement",
        nodeKey: CONTEXT_NODE_KEY,
        programKey: PROGRAM_KEY,
      },
      deviceId: "stale-device",
      locale: "id",
    });
    await t.mutation(async (ctx) => {
      await ctx.db.delete(fixture.placementId);
    });

    const results = await signedIn.query(
      api.contents.queries.recent.getRecentlyViewed,
      { locale: "id", limit: 5 }
    );

    expect(results).toMatchObject([
      {
        contextKey: "canonical",
        href: `/${PUBLIC_LESSON_PATH}`,
      },
    ]);
  });
});
