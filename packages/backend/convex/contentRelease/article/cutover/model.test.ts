import {
  readArticleDateCutover,
  removeLegacyArticleDates,
  restoreLegacyArticleDates,
} from "@repo/backend/convex/contentRelease/article/cutover/model";
import { ARTICLE_DATE_CUTOVER_LIMIT } from "@repo/backend/convex/contentRelease/article/cutover/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  insertRuntimeArticles,
  insertRuntimeRelease,
} from "@repo/backend/test/content-runtime";
import { TEST_RUNTIME_RELEASE } from "@repo/backend/test/runtime-values";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

const REQUEST = {
  expectedManifestHash: TEST_RUNTIME_RELEASE.manifestHash,
  expectedReleaseId: TEST_RUNTIME_RELEASE.releaseId,
  expectedSequence: TEST_RUNTIME_RELEASE.sequence,
};

afterEach(() => {
  vi.useRealTimers();
});

describe("contentRelease/article/cutover/model", () => {
  it("removes and restores exact dual-written dates idempotently", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.UTC(2026, 7, 27, 12));
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, 2);
      for (const row of await ctx.db.query("articleCatalog").take(2)) {
        if (!("datePublished" in row)) {
          throw new Error("Expected one current article date.");
        }
        await ctx.db.patch("articleCatalog", row._id, {
          date: row.datePublished,
        });
      }
    });

    await expect(
      t.run((ctx) => runConvexProgram(readArticleDateCutover(ctx, REQUEST)))
    ).resolves.toMatchObject({
      active: {
        manifestHash: REQUEST.expectedManifestHash,
        releaseId: REQUEST.expectedReleaseId,
        sequence: REQUEST.expectedSequence,
      },
      counts: { currentOnly: 0, dual: 2, legacyOnly: 0, total: 2 },
    });

    await expect(
      t.mutation((ctx) =>
        runConvexProgram(removeLegacyArticleDates(ctx, REQUEST))
      )
    ).resolves.toMatchObject({
      changed: 2,
      counts: { currentOnly: 2, dual: 0, legacyOnly: 0, total: 2 },
      executedAt: Date.UTC(2026, 7, 27, 12),
      operation: "remove",
      unchanged: 0,
    });
    const current = await t.run((ctx) =>
      ctx.db.query("articleCatalog").take(2)
    );
    expect(current.every((row) => !("date" in row))).toBe(true);
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(removeLegacyArticleDates(ctx, REQUEST))
      )
    ).resolves.toMatchObject({ changed: 0, unchanged: 2 });

    await expect(
      t.mutation((ctx) =>
        runConvexProgram(restoreLegacyArticleDates(ctx, REQUEST))
      )
    ).resolves.toMatchObject({
      changed: 2,
      counts: { currentOnly: 0, dual: 2, legacyOnly: 0, total: 2 },
      operation: "restore",
      unchanged: 0,
    });
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(restoreLegacyArticleDates(ctx, REQUEST))
      )
    ).resolves.toMatchObject({ changed: 0, unchanged: 2 });
  });

  it("fails closed for release drift, staged work, and unsafe dates", async () => {
    const drift = convexTest(schema, convexModules);
    await drift.mutation((ctx) => insertRuntimeArticles(ctx, 1));
    await expect(
      drift.run((ctx) =>
        runConvexProgram(
          readArticleDateCutover(ctx, {
            ...REQUEST,
            expectedSequence: REQUEST.expectedSequence + 1,
          })
        )
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });

    const staged = convexTest(schema, convexModules);
    await staged.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, 1);
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        throw new Error("Expected one content state.");
      }
      await ctx.db.patch("contentState", state._id, {
        candidateManifestHash: `sha256:${"a".repeat(64)}`,
        candidateReleaseId: "release-candidate",
        candidateSequence: REQUEST.expectedSequence + 1,
      });
    });
    await expect(
      staged.run((ctx) =>
        runConvexProgram(readArticleDateCutover(ctx, REQUEST))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } });

    const legacy = convexTest(schema, convexModules);
    await legacy.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, 1);
      const row = await ctx.db.query("articleCatalog").unique();
      if (!(row && "datePublished" in row)) {
        throw new Error("Expected one current article date.");
      }
      const {
        _creationTime,
        _id,
        date: _date,
        dateModified: _dateModified,
        datePublished,
        ...legacyFields
      } = row;
      await ctx.db.replace("articleCatalog", row._id, {
        ...legacyFields,
        date: datePublished,
      });
    });
    await expect(
      legacy.mutation((ctx) =>
        runConvexProgram(removeLegacyArticleDates(ctx, REQUEST))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });

    const conflict = convexTest(schema, convexModules);
    await conflict.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, 1);
      const row = await ctx.db.query("articleCatalog").unique();
      if (!row) {
        throw new Error("Expected one current article date.");
      }
      await ctx.db.patch("articleCatalog", row._id, { date: "2020-01-01" });
    });
    await expect(
      conflict.run((ctx) =>
        runConvexProgram(readArticleDateCutover(ctx, REQUEST))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it("rejects a catalog larger than the atomic transaction bound", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await insertRuntimeRelease(ctx);
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        throw new Error("Expected one content state.");
      }
      await ctx.db.patch("contentState", state._id, {
        articleManifestHash: TEST_RUNTIME_RELEASE.manifestHash,
        articleReleaseId: TEST_RUNTIME_RELEASE.releaseId,
        articleSequence: TEST_RUNTIME_RELEASE.sequence,
      });
      for (let index = 0; index <= ARTICLE_DATE_CUTOVER_LIMIT; index += 1) {
        await ctx.db.insert("articleCatalog", {
          appLocale: "en",
          assetId: `article-${index}`,
          bucket: "aaa",
          category: "politics",
          categoryTitle: "Politics",
          contentKey: `articles/politics/${index}`,
          datePublished: "2026-08-22",
          projectionHash: `sha256:${index.toString(16).padStart(64, "0")}`,
          publicPath: `articles/politics/${index}`,
          releaseId: TEST_RUNTIME_RELEASE.releaseId,
          rendererDomain: "politics",
          sequence: TEST_RUNTIME_RELEASE.sequence,
        });
      }
    });

    await expect(
      t.run((ctx) => runConvexProgram(readArticleDateCutover(ctx, REQUEST)))
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_LIMIT" } });
  });
});
