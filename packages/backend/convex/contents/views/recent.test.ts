import { describe, expect, it } from "@effect/vitest";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  createCanonicalLearningContext,
  createContextKey,
  type LearningContextStorage,
} from "@repo/backend/convex/contents/context";
import { upsertUserRecent } from "@repo/backend/convex/contents/views/recent";
import type { ContentViewTarget } from "@repo/backend/convex/contents/views/target";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  createConvexTestWithBetterAuth,
  seedAuthenticatedUser,
} from "@repo/backend/convex/test.helpers";
import { makeMaterialProjection } from "@repo/backend/test/content/material";

const NOW = Date.UTC(2026, 4, 29, 10, 0, 0);
const CONTEXT_PROGRAM_KEY = "merdeka";
const CONTEXT_NODE_KEY = "class-10-mathematics-vector";
const projection = makeMaterialProjection("en", 1);
const target = {
  ...projection.graph,
  contentKey: projection.contentKey,
  content_id: projection.graph.assetId,
  description: projection.metadata.description,
  kind: "curriculum-lesson",
  locale: "en",
  materialDomain: MaterialDomainSchema.make("mathematics"),
  materialKey: projection.materialKey,
  parentPath: projection.parentPath,
  route: projection.publicPath,
  section: "material",
  sourcePath: `packages/corpus/${projection.contentKey}/${projection.artifactLocale}.mdx`,
  title: projection.metadata.title,
} satisfies ContentViewTarget;
const placementContext: LearningContextStorage = {
  contextKey: createContextKey({
    mode: "placement",
    nodeKey: CONTEXT_NODE_KEY,
    programKey: CONTEXT_PROGRAM_KEY,
  }),
  contextMaterialKey: projection.materialKey,
  contextMode: "placement",
  contextNodeKey: CONTEXT_NODE_KEY,
  contextParentPath: "curriculum/merdeka/class-10/mathematics",
  contextProgramKey: CONTEXT_PROGRAM_KEY,
  contextPublicPath: "curriculum/merdeka/class-10/mathematics/vector",
  contextSourcePath: projection.contentKey,
};

/** Reads the small recent fixture table used by this test. */
async function readRecents(ctx: MutationCtx) {
  return await ctx.db.query("userLearningRecents").take(10);
}

describe("contents/views/recent", () => {
  it("keeps one user recent row while the latest material context changes", async () => {
    const t = createConvexTestWithBetterAuth();
    const result = await t.mutation(async (ctx) => {
      const user = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "recent-context",
      });
      await runConvexProgram(
        upsertUserRecent(ctx.db, target, createCanonicalLearningContext(), {
          lastViewedAt: NOW,
          userId: user.userId,
        })
      );
      await runConvexProgram(
        upsertUserRecent(ctx.db, target, placementContext, {
          lastViewedAt: NOW + 1000,
          userId: user.userId,
        })
      );
      const placementRecents = await readRecents(ctx);
      await runConvexProgram(
        upsertUserRecent(ctx.db, target, createCanonicalLearningContext(), {
          lastViewedAt: NOW + 2000,
          userId: user.userId,
        })
      );
      return {
        placementRecents,
        recents: await readRecents(ctx),
        userId: user.userId,
      };
    });

    expect(result.placementRecents).toHaveLength(1);
    expect(result.placementRecents[0]).toMatchObject({
      content_id: target.content_id,
      contextKey: placementContext.contextKey,
      contextMode: "placement",
      contextNodeKey: CONTEXT_NODE_KEY,
      contextProgramKey: CONTEXT_PROGRAM_KEY,
      lastViewedAt: NOW + 1000,
      userId: result.userId,
    });
    expect(result.recents).toHaveLength(1);
    expect(result.recents[0]).toMatchObject({
      content_id: target.content_id,
      contextKey: "canonical",
      contextMode: "canonical",
      lastViewedAt: NOW + 2000,
      userId: result.userId,
    });
    expect(result.recents[0]).not.toHaveProperty("contextNodeKey");
    expect(result.recents[0]).not.toHaveProperty("contextProgramKey");
  });
});

import { MaterialDomainSchema } from "@nakafa/aksara-contracts/material/domain";
