import { describe, expect, it } from "@effect/vitest";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { ARTICLE_PREDECESSOR_LIMIT } from "@repo/backend/convex/contentRelease/article/limits";
import { validateArticleModel } from "@repo/backend/convex/contentRelease/article/validation";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  categorizedArticle,
  insertPredecessorArticle,
} from "@repo/backend/test/article/release";
import type { TestIdentity } from "@repo/backend/test/content/state";
import { convexTest } from "convex-test";

const PREDECESSOR = {
  manifestHash: `sha256:${"5".repeat(64)}`,
  releaseId: "release-article-validation-predecessor",
  sequence: 1,
} satisfies TestIdentity;

/** Inserts the maximum predecessor inventory through its exact bridge shape. */
async function insertMaximumPredecessors(ctx: MutationCtx) {
  for (let index = 0; index < ARTICLE_PREDECESSOR_LIMIT; index += 1) {
    const suffix = index.toString().padStart(3, "0");
    const projection = categorizedArticle({
      article: index,
      category: `topic-${suffix}`,
      route: `topic-${suffix}`,
      title: `Topic ${suffix}`,
    });
    await insertPredecessorArticle(ctx, PREDECESSOR, projection);
  }
}

describe("contentRelease/article/validation", () => {
  it("shares the maximum predecessor inventory across eight category claims", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(insertMaximumPredecessors);

    await expect(
      t.mutation((ctx) =>
        runConvexProgram(validateArticleModel(ctx, undefined))
      )
    ).resolves.toMatchObject({
      cursor: expect.any(String),
      done: false,
      processed: 8,
    });
  });
});
