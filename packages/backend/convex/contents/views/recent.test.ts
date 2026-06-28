import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createCanonicalLearningContext,
  createContextKey,
  type LearningContextStorage,
} from "@repo/backend/convex/contents/context";
import { upsertUserRecent } from "@repo/backend/convex/contents/views/recent";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 4, 29, 10, 0, 0);
const MATERIAL_ROUTE = "material/lesson/mathematics/vector/addition";
const CONTEXT_PROGRAM_KEY = "merdeka";
const CONTEXT_NODE_KEY = "class-10-mathematics-vector";

const placementContext: LearningContextStorage = {
  contextKey: createContextKey({
    mode: "placement",
    nodeKey: CONTEXT_NODE_KEY,
    programKey: CONTEXT_PROGRAM_KEY,
  }),
  contextMaterialKey: "lesson.mathematics.vector",
  contextMode: "placement",
  contextNodeKey: CONTEXT_NODE_KEY,
  contextParentPath: "curriculum/merdeka/class-10/mathematics",
  contextProgramKey: CONTEXT_PROGRAM_KEY,
  contextPublicPath: "curriculum/merdeka/class-10/mathematics/vector",
  contextSourcePath: MATERIAL_ROUTE,
};

/** Inserts one graph route projection for the recent read-model fixture. */
async function insertMaterialRoute(ctx: MutationCtx) {
  const identity = createLearningGraphIdentityFromRoute({
    locale: "id",
    route: MATERIAL_ROUTE,
  });

  if (!identity) {
    expect.fail(`Unable to build graph fixture for ${MATERIAL_ROUTE}.`);
  }

  const routeId = await ctx.db.insert("contentRoutes", {
    ...identity,
    assetId: identity.assetId,
    authors: [],
    contentHash: "material-route-hash",
    content_id: identity.assetId,
    kind: "curriculum-lesson",
    locale: "id",
    markdown: true,
    materialDomain: "mathematics",
    route: MATERIAL_ROUTE,
    section: "material",
    sourcePath: MATERIAL_ROUTE,
    syncedAt: NOW,
    title: "Vector Addition",
  });
  const route = await ctx.db.get(routeId);

  if (!route) {
    expect.fail("Expected inserted content route fixture.");
  }

  return route;
}

/** Reads the small recent fixture table used by this test. */
async function readRecents(ctx: MutationCtx) {
  return await ctx.db.query("userLearningRecents").take(10);
}

/** Writes one Continue Learning recent row with an explicit view timestamp. */
async function upsertRecent(
  ctx: MutationCtx,
  route: Doc<"contentRoutes">,
  context: LearningContextStorage,
  input: {
    readonly lastViewedAt: number;
    readonly userId: Doc<"users">["_id"];
  }
) {
  await runConvexProgram(upsertUserRecent(ctx.db, route, context, input));
}

describe("contents/views/recent", () => {
  it("keeps one user recent row while the latest material context changes", async () => {
    const t = createConvexTestWithBetterAuth();

    const result = await t.mutation(async (ctx) => {
      const route = await insertMaterialRoute(ctx);
      const user = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "recent-context",
      });

      await upsertRecent(ctx, route, createCanonicalLearningContext(), {
        lastViewedAt: NOW,
        userId: user.userId,
      });
      await upsertRecent(ctx, route, placementContext, {
        lastViewedAt: NOW + 1000,
        userId: user.userId,
      });

      const placementRecents = await readRecents(ctx);

      await upsertRecent(ctx, route, createCanonicalLearningContext(), {
        lastViewedAt: NOW + 2000,
        userId: user.userId,
      });

      return {
        contentId: route.content_id,
        placementRecents,
        recents: await readRecents(ctx),
        userId: user.userId,
      };
    });

    expect(result.placementRecents).toHaveLength(1);
    expect(result.placementRecents[0]).toMatchObject({
      content_id: result.contentId,
      contextKey: placementContext.contextKey,
      contextMode: "placement",
      contextNodeKey: CONTEXT_NODE_KEY,
      contextProgramKey: CONTEXT_PROGRAM_KEY,
      lastViewedAt: NOW + 1000,
      userId: result.userId,
    });

    expect(result.recents).toHaveLength(1);
    expect(result.recents[0]).toMatchObject({
      content_id: result.contentId,
      contextKey: "canonical",
      contextMode: "canonical",
      lastViewedAt: NOW + 2000,
      userId: result.userId,
    });
    expect(result.recents[0]).not.toHaveProperty("contextNodeKey");
    expect(result.recents[0]).not.toHaveProperty("contextProgramKey");
  });
});
