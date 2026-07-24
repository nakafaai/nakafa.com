import {
  ContentKeySchema,
  CorpusSourcePathSchema,
  PublicPathSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  ArticleProjectionSchema,
  ArticleSlugSchema,
  canonicalizeArticleProjection,
} from "@nakafa/aksara-contracts/projection/article";
import { api } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  TEST_DIGEST,
  testArticleGraph,
  testProjectionJson,
  testRouteJson,
  testTextHash,
} from "@repo/backend/test/content-release";
import {
  insertRuntimeRelease,
  TEST_RUNTIME_RELEASE,
} from "@repo/backend/test/content-runtime";
import { zeroReleaseJson } from "@repo/backend/test/content-state";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const readPage = api.contentRelease.article.page;

/** Builds one exact technical article projection without authored lesson text. */
function articleProjection(index: number) {
  const suffix = `${index}`.padStart(3, "0");
  const slug = ArticleSlugSchema.make(`article-${suffix}`);
  const contentKey = ContentKeySchema.make(`articles/politics/${slug}`);
  const publicPath = PublicPathSchema.make(contentKey);
  return ArticleProjectionSchema.make({
    articleSlug: slug,
    category: "politics",
    contentKey,
    graph: testArticleGraph(`article-${suffix}`),
    kind: "article",
    locale: "en",
    metadata: {
      authors: [{ name: "Nakafa" }],
      date: "2026-07-24",
      title: `Technical article ${suffix}`,
    },
    official: false,
    parentPath: PublicPathSchema.make("articles/politics"),
    publicPath,
    references: [],
    sitemap: true,
  });
}

/** Inserts one complete active article identity for catalog tests. */
async function insertArticle(
  ctx: MutationCtx,
  index: number,
  options?: {
    readonly createdSequence?: number;
    readonly operation?: "delete" | "upsert";
    readonly projectionHash?: string;
  }
) {
  const projection = articleProjection(index);
  const projectionJson = canonicalizeArticleProjection(projection);
  const sequence = options?.createdSequence ?? TEST_RUNTIME_RELEASE.sequence;
  const sourcePath = CorpusSourcePathSchema.make(
    `packages/corpus/articles/politics/article-${index}/en.mdx`
  );
  await ctx.db.insert("contentKeys", {
    contentKey: projection.contentKey,
    createdSequence: sequence,
    family: "article",
    locale: "en",
  });
  if (options?.operation === "delete") {
    await ctx.db.insert("contentHeads", {
      contentKey: projection.contentKey,
      family: "article",
      index,
      locale: "en",
      operation: "delete",
      releaseId: TEST_RUNTIME_RELEASE.releaseId,
      sequence,
    });
    return;
  }
  await ctx.db.insert("contentHeads", {
    artifactHash: TEST_DIGEST,
    compilerConfigHash: TEST_DIGEST,
    contentKey: projection.contentKey,
    delivery: "public",
    family: "article",
    index,
    locale: "en",
    operation: "upsert",
    projectionHash: options?.projectionHash ?? testTextHash(projectionJson),
    projectionJson,
    releaseId: TEST_RUNTIME_RELEASE.releaseId,
    rendererDomain: "politics",
    sequence,
    sourceHash: TEST_DIGEST,
    sourcePath,
  });
  await ctx.db.insert("contentPaths", {
    createdSequence: sequence,
    locale: "en",
    publicPath: projection.publicPath,
  });
  await ctx.db.insert("contentBindings", {
    batchHash: TEST_DIGEST,
    batchIndex: 0,
    contentKey: projection.contentKey,
    index,
    locale: "en",
    operation: "bind",
    publicPath: projection.publicPath,
    releaseId: TEST_RUNTIME_RELEASE.releaseId,
    routeJson: testRouteJson({
      contentKey: projection.contentKey,
      index,
      publicPath: projection.publicPath,
      releaseId: TEST_RUNTIME_RELEASE.releaseId,
    }),
    sequence,
  });
}

/** Corrupts one otherwise-complete active article and asserts its typed code. */
async function expectArticleFailure(
  corrupt: (ctx: MutationCtx) => Promise<void>,
  code: "CONTENT_RELEASE_INTEGRITY" | "CONTENT_RELEASE_ROUTE"
) {
  const t = convexTest(schema, convexModules);
  await t.mutation(async (ctx) => {
    await insertRuntimeRelease(ctx);
    await insertArticle(ctx, 1);
    await corrupt(ctx);
  });
  await expect(
    t.query(readPage, { cursor: null, locale: "en" })
  ).rejects.toMatchObject({ data: { code } });
}

describe("contentRelease/article", () => {
  it("returns only verified active article projections with Git provenance", async () => {
    const empty = convexTest(schema, convexModules);
    await expect(
      empty.query(readPage, { cursor: null, locale: "en" })
    ).resolves.toEqual({
      activeReleaseId: null,
      done: true,
      items: [],
      nextCursor: null,
      sourceRevision: null,
    });

    const active = convexTest(schema, convexModules);
    await active.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      await insertArticle(ctx, 1);
      await insertArticle(ctx, 2, {
        createdSequence: TEST_RUNTIME_RELEASE.sequence + 1,
      });
      await insertArticle(ctx, 3, { operation: "delete" });
    });
    const page = await active.query(readPage, {
      cursor: null,
      locale: "en",
    });

    expect(page).toMatchObject({
      activeReleaseId: TEST_RUNTIME_RELEASE.releaseId,
      done: true,
      nextCursor: null,
      sourceRevision: "a".repeat(40),
    });
    expect(page.items).toHaveLength(1);
    expect(JSON.parse(page.items[0]?.projectionJson ?? "{}")).toMatchObject({
      articleSlug: "article-001",
      kind: "article",
    });

    const rollback = convexTest(schema, convexModules);
    await rollback.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      const release = await ctx.db.query("contentReleases").unique();
      if (!release) {
        throw new Error("Expected one active release.");
      }
      await ctx.db.patch("contentReleases", release._id, {
        releaseJson: zeroReleaseJson({
          ...TEST_RUNTIME_RELEASE,
          base: {
            manifestHash: TEST_DIGEST,
            releaseId: "release-prior",
            sequence: TEST_RUNTIME_RELEASE.sequence - 1,
          },
          originReleaseId: "release-prior",
          role: "recovery",
          status: "completed",
        }),
      });
    });
    await expect(
      rollback.query(readPage, { cursor: null, locale: "en" })
    ).resolves.toMatchObject({ sourceRevision: null });
  });

  it("paginates the permanent active article directory at a fixed bound", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      for (let index = 0; index < 101; index += 1) {
        await insertArticle(ctx, index);
      }
    });

    const first = await t.query(readPage, { cursor: null, locale: "en" });
    const second = await t.query(readPage, {
      cursor: first.nextCursor,
      locale: "en",
    });

    expect(first).toMatchObject({ done: false });
    expect(first.items).toHaveLength(100);
    expect(first.nextCursor).not.toBeNull();
    expect(second).toMatchObject({ done: true, nextCursor: null });
    expect(second.items).toHaveLength(1);
  });

  it("fails visibly when projection or route integrity drifts", async () => {
    await expectArticleFailure(async (ctx) => {
      const head = await ctx.db.query("contentHeads").unique();
      if (!head) {
        throw new Error("Expected one article head.");
      }
      await ctx.db.patch("contentHeads", head._id, {
        projectionHash: TEST_DIGEST,
      });
    }, "CONTENT_RELEASE_INTEGRITY");

    await expectArticleFailure(async (ctx) => {
      const path = await ctx.db.query("contentPaths").unique();
      if (!path) {
        throw new Error("Expected one article path.");
      }
      await ctx.db.delete("contentPaths", path._id);
    }, "CONTENT_RELEASE_ROUTE");
  });

  it("rejects incomplete, foreign, and contradictory active versions", async () => {
    await expectArticleFailure(async (ctx) => {
      const head = await ctx.db.query("contentHeads").unique();
      if (!head) {
        throw new Error("Expected one article head.");
      }
      await ctx.db.patch("contentHeads", head._id, {
        delivery: "authenticated",
      });
    }, "CONTENT_RELEASE_INTEGRITY");

    await expectArticleFailure(async (ctx) => {
      const head = await ctx.db.query("contentHeads").unique();
      if (!head) {
        throw new Error("Expected one article head.");
      }
      await ctx.db.patch("contentHeads", head._id, {
        projectionJson: undefined,
      });
    }, "CONTENT_RELEASE_INTEGRITY");

    await expectArticleFailure(async (ctx) => {
      const head = await ctx.db.query("contentHeads").unique();
      if (!head) {
        throw new Error("Expected one article head.");
      }
      const projectionJson = testProjectionJson();
      await ctx.db.patch("contentHeads", head._id, {
        projectionHash: testTextHash(projectionJson),
        projectionJson,
      });
    }, "CONTENT_RELEASE_INTEGRITY");

    await expectArticleFailure(async (ctx) => {
      const binding = await ctx.db.query("contentBindings").unique();
      if (!binding) {
        throw new Error("Expected one article binding.");
      }
      await ctx.db.delete("contentBindings", binding._id);
    }, "CONTENT_RELEASE_ROUTE");

    await expectArticleFailure(async (ctx) => {
      const binding = await ctx.db.query("contentBindings").unique();
      if (!binding) {
        throw new Error("Expected one article binding.");
      }
      await ctx.db.patch("contentBindings", binding._id, {
        releaseId: "release-other",
      });
    }, "CONTENT_RELEASE_INTEGRITY");

    await expectArticleFailure(async (ctx) => {
      const path = await ctx.db.query("contentPaths").unique();
      if (!path) {
        throw new Error("Expected one article path.");
      }
      await ctx.db.patch("contentPaths", path._id, {
        createdSequence: TEST_RUNTIME_RELEASE.sequence + 1,
      });
    }, "CONTENT_RELEASE_ROUTE");
  });
});
