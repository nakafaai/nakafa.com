import { assert, describe, expect, it } from "@effect/vitest";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  syncArticles,
  verifyArticleBuild,
} from "@repo/backend/convex/contentRelease/article/sync";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { insertArticleProjection } from "@repo/backend/test/article/release";
import { insertCompletedRelease } from "@repo/backend/test/content/model";
import { testArticleProjection } from "@repo/backend/test/content/runtime";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const identity = {
  manifestHash: `sha256:${"6".repeat(64)}`,
  releaseId: "article-sync-candidate",
  sequence: 1,
};

/** Creates a durable inactive build with two real published article heads. */
async function stageBuild(ctx: MutationCtx) {
  await insertCompletedRelease(ctx, identity, 2);
  for (let index = 0; index < 2; index += 1) {
    await insertArticleProjection(
      ctx,
      identity,
      index,
      testArticleProjection(index)
    );
  }
  const id = await ctx.db.insert("contentModelBuilds", {
    base: { kind: "empty" },
    generation: 1,
    itemIndex: -1,
    key: "primary",
    manifestHash: identity.manifestHash,
    phase: "articleApply",
    releaseId: identity.releaseId,
    sequence: identity.sequence,
    slots: {
      articleBaseSlot: "blue",
      articleTargetSlot: "green",
      materialBaseSlot: "blue",
      materialTargetSlot: "blue",
      searchBaseSlot: "blue",
      searchTargetSlot: "green",
    },
    updatedAt: 1,
  });
  const build = await ctx.db.get("contentModelBuilds", id);
  const release = await ctx.db.query("contentReleases").unique();
  assert(build && release);
  return { build, release };
}

describe("article inactive-buffer synchronization", () => {
  it.effect(
    "writes and verifies a complete changed page before the active slot moves",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const staged = yield* Effect.promise(() => t.mutation(stageBuild));
        const signed = yield* decodeReleaseJson(staged.release.releaseJson);
        const result = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(
              syncArticles(ctx, staged.build, staged.release, signed)
            )
          )
        );
        expect(result).toEqual({ done: true, itemIndex: 1, processed: 2 });
        const rows = yield* Effect.promise(() =>
          t.query((ctx) => ctx.db.query("articleCatalog").collect())
        );
        expect(rows).toHaveLength(2);
        expect(rows.every((row) => row.slot === "green")).toBe(true);
        const verified = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(
              verifyArticleBuild(ctx, {
                ...staged.build,
                phase: "articleVerify",
              })
            )
          )
        );
        expect(verified).toEqual({
          cursor: undefined,
          done: true,
          processed: 2,
        });
      })
  );

  it.effect(
    "removes an inherited article whose effective head is now a deletion",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const staged = yield* Effect.promise(() => t.mutation(stageBuild));
        const signed = yield* decodeReleaseJson(staged.release.releaseJson);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(
              syncArticles(ctx, staged.build, staged.release, signed)
            )
          )
        );
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            const heads = await ctx.db.query("contentHeads").collect();
            const head = heads.find(
              (row) => row.contentKey === testArticleProjection(0).contentKey
            );
            assert(head);
            await ctx.db.patch("contentHeads", head._id, {
              operation: "delete",
            });
          })
        );
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(
              syncArticles(ctx, staged.build, staged.release, signed)
            )
          )
        );
        const rows = yield* Effect.promise(() =>
          t.query((ctx) => ctx.db.query("articleCatalog").collect())
        );
        expect(rows).toMatchObject([
          { contentKey: testArticleProjection(1).contentKey, slot: "green" },
        ]);
        const categories = yield* Effect.promise(() =>
          t.query((ctx) => ctx.db.query("articleCategories").collect())
        );
        expect(categories).toMatchObject([
          { contentKey: testArticleProjection(1).contentKey, slot: "green" },
        ]);
      })
  );
});
