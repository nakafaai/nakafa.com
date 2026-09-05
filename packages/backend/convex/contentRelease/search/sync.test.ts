import { describe, expect, it } from "@effect/vitest";
import { decodeReleaseJson } from "@repo/backend/convex/contentRelease/parse";
import { syncSearch } from "@repo/backend/convex/contentRelease/search/sync";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { insertArticleProjection } from "@repo/backend/test/article/release";
import { testArtifactJson } from "@repo/backend/test/content/artifact";
import { insertCompletedRelease } from "@repo/backend/test/content/model";
import { testUpsertJson } from "@repo/backend/test/content/release";
import { testArticleProjection } from "@repo/backend/test/content/runtime";
import { Effect } from "effect";

const identity = {
  manifestHash: `sha256:${"6".repeat(64)}`,
  releaseId: "search-sync-candidate",
  sequence: 1,
};

/** Seeds an inactive search buffer from one completed article change. */
async function stageBuild() {
  const t = createConvexTestWithBetterAuth();
  await t.mutation(async (ctx) => {
    await insertCompletedRelease(ctx, identity, 1);
    await insertArticleProjection(ctx, identity, 0, testArticleProjection(0));
    await ctx.db.insert("contentModelBuilds", {
      base: { kind: "empty" },
      generation: 1,
      itemIndex: -1,
      key: "primary",
      manifestHash: identity.manifestHash,
      phase: "searchApply",
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
  });
  return t;
}

/** Applies the real durable build through its mutation transaction. */
function synchronize(t: Awaited<ReturnType<typeof stageBuild>>) {
  return t.mutation(async (ctx) => {
    const build = await ctx.db.query("contentModelBuilds").unique();
    const release = await ctx.db.query("contentReleases").unique();
    if (!(build && release)) {
      return expect.fail("Expected one release and inactive search build.");
    }
    return runConvexProgram(
      Effect.gen(function* () {
        const signed = yield* decodeReleaseJson(release.releaseJson);
        return yield* syncSearch(ctx, build, release, signed);
      })
    );
  });
}

describe("inactive search publication synchronization", () => {
  it("indexes verified article text and removes its inherited tombstone", async () => {
    const t = await stageBuild();
    expect(await synchronize(t)).toEqual({
      done: true,
      itemIndex: 0,
      processed: 1,
    });
    expect(
      await t.query((ctx) => ctx.db.query("contentIndex").unique())
    ).toMatchObject({
      contentKey: testArticleProjection(0).contentKey,
      family: "article",
      slot: "green",
      releaseId: identity.releaseId,
      text: expect.stringContaining(testArticleProjection(0).metadata.title),
    });
    await t.mutation(async (ctx) => {
      const head = await ctx.db.query("contentHeads").unique();
      if (!head) {
        return expect.fail("Expected the article's immutable head.");
      }
      await ctx.db.patch(head._id, { operation: "delete" });
    });
    expect(await synchronize(t)).toEqual({
      done: true,
      itemIndex: 0,
      processed: 1,
    });
    expect(
      await t.query((ctx) => ctx.db.query("contentIndex").collect())
    ).toEqual([]);
  });

  it("leaves non-searchable page identities out of the search buffer", async () => {
    const t = await stageBuild();
    await t.mutation(async (ctx) => {
      const item = await ctx.db.query("contentItems").unique();
      if (!item) {
        return expect.fail("Expected one changed content item.");
      }
      await ctx.db.patch(item._id, {
        contentKey: "pages/imprint",
        itemJson: testUpsertJson({
          contentKey: "pages/imprint",
          family: "page",
          releaseId: identity.releaseId,
          rendererDomain: "site",
          sourcePath: "packages/corpus/pages/imprint/en.mdx",
        }),
      });
    });
    expect(await synchronize(t)).toEqual({
      done: true,
      itemIndex: 0,
      processed: 1,
    });
    expect(
      await t.query((ctx) => ctx.db.query("contentIndex").collect())
    ).toEqual([]);
  });

  it.each([
    "missing artifact",
    "changed artifact",
    "changed item",
    "incomplete head",
  ])("fails closed for a %s before exposing a search row", async (failure) => {
    const t = await stageBuild();
    await t.mutation(async (ctx) => {
      const artifact = await ctx.db.query("contentArtifacts").unique();
      const item = await ctx.db.query("contentItems").unique();
      const head = await ctx.db.query("contentHeads").unique();
      if (!(artifact && item && head)) {
        return expect.fail("Expected one complete staged article.");
      }
      if (failure === "missing artifact") {
        return ctx.db.delete(artifact._id);
      }
      if (failure === "changed artifact") {
        return ctx.db.patch(artifact._id, {
          artifactJson: testArtifactJson({ contentKey: "test:other" }),
        });
      }
      if (failure === "changed item") {
        return ctx.db.patch(item._id, {
          itemJson: testUpsertJson({
            contentKey: "test:other",
            family: "article",
          }),
        });
      }
      return ctx.db.patch(head._id, { artifactHash: undefined });
    });
    await expect(synchronize(t)).rejects.toMatchObject({
      data: {
        code:
          failure === "missing artifact"
            ? "CONTENT_RELEASE_MISSING"
            : "CONTENT_RELEASE_INTEGRITY",
      },
    });
    expect(
      await t.query((ctx) => ctx.db.query("contentIndex").collect())
    ).toEqual([]);
  });
});
