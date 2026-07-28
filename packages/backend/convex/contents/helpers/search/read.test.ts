import { readContentSearchDocuments } from "@repo/backend/convex/contents/helpers/search/read";
import type { contentSearchInputValidator } from "@repo/backend/convex/contents/helpers/search/schema";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { makeMaterialProjection } from "@repo/backend/test/content-material";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content-runtime";
import {
  activateMaterialCatalog,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material-catalog";
import { insertRuntimeIndex } from "@repo/backend/test/runtime-head";
import { TEST_RUNTIME_RELEASE } from "@repo/backend/test/runtime-values";
import {
  getPublicSearchPath,
  insertContentSearch,
  searchContentId,
} from "@repo/backend/test/search";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import type { Infer } from "convex/values";
import { describe, expect, it } from "vitest";

const searchArgs: Infer<typeof contentSearchInputValidator> = {
  limit: 10,
  locale: "id",
  offset: 0,
  section: "tryout",
};

describe("readContentSearchDocuments", () => {
  it("uses active article ownership without stale source results", async () => {
    const t = createConvexTestWithBetterAuth();
    const projection = testArticleProjection(0);
    await t.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, 1);
      await insertRuntimeIndex(ctx, projection.contentKey, {
        plainText: "release owned searchable article",
      });
      await insertContentSearch(ctx, {
        contentHash: "stale-source-search",
        description: "",
        locale: projection.locale,
        route: "articles/politics/stale-source",
        section: "articles",
        syncedAt: 1,
        text: "release owned searchable article",
        title: "Stale source article",
      });
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        throw new Error("Expected one active content state.");
      }
      await ctx.db.patch("contentState", state._id, {
        searchManifestHash: TEST_RUNTIME_RELEASE.manifestHash,
        searchReleaseId: TEST_RUNTIME_RELEASE.releaseId,
        searchSequence: TEST_RUNTIME_RELEASE.sequence,
      });
    });

    const documents = await t.query((ctx) =>
      runConvexProgram(
        readContentSearchDocuments(
          ctx,
          {
            limit: 10,
            locale: projection.locale,
            offset: 0,
            queries: ["release owned searchable article"],
            section: "articles",
          },
          ["release owned searchable article"],
          10
        )
      )
    );

    expect(documents).toMatchObject([
      {
        content_id: projection.graph.assetId,
        route: projection.publicPath,
        section: "articles",
        title: projection.metadata.title,
      },
    ]);
  });

  it("shares one published read budget across alternate query variants", async () => {
    const t = createConvexTestWithBetterAuth();
    const terms = ["alpha", "beta", "gamma", "delta"];

    await t.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, terms.length);
      for (const [index, term] of terms.entries()) {
        const projection = testArticleProjection(index);
        await insertRuntimeIndex(ctx, projection.contentKey, {
          plainText: `${term} bounded search`,
        });
      }
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        throw new Error("Expected one active content state.");
      }
      await ctx.db.patch("contentState", state._id, {
        searchManifestHash: TEST_RUNTIME_RELEASE.manifestHash,
        searchReleaseId: TEST_RUNTIME_RELEASE.releaseId,
        searchSequence: TEST_RUNTIME_RELEASE.sequence,
      });
    });

    const documents = await t.query((ctx) =>
      runConvexProgram(
        readContentSearchDocuments(
          ctx,
          {
            limit: 3,
            locale: "en",
            offset: 0,
            queries: terms,
            section: "articles",
          },
          terms,
          3
        )
      )
    );

    expect(documents).toHaveLength(3);
    expect(documents.map((document) => document.text)).toEqual([
      "Article 0 Article 0 articles/politics/article-0 alpha bounded search",
      "Article 1 Article 1 articles/politics/article-1 beta bounded search",
      "Article 2 Article 2 articles/politics/article-2 gamma bounded search",
    ]);
  });

  it("reads source-only sections while release search is synchronizing", async () => {
    const t = createConvexTestWithBetterAuth();
    const fixtures: readonly {
      readonly query: string;
      readonly route: string;
      readonly section: "quran" | "tryout";
    }[] = [
      { query: "Al-Fatihah", route: "quran/1", section: "quran" },
      {
        query: "Penalaran Umum",
        route: "try-out/indonesia/snbt/2027/set-2/penalaran-umum",
        section: "tryout",
      },
    ];
    await t.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, 1);
      for (const fixture of fixtures) {
        await insertContentSearch(ctx, {
          contentHash: `hash-${fixture.section}-source-only`,
          description: "",
          locale: "id",
          route: fixture.route,
          section: fixture.section,
          syncedAt: 1,
          text: `${fixture.query} source-only search`,
          title: fixture.query,
        });
      }
    });

    for (const fixture of fixtures) {
      const documents = await t.query((ctx) =>
        runConvexProgram(
          readContentSearchDocuments(
            ctx,
            {
              limit: 10,
              locale: "id",
              offset: 0,
              queries: [fixture.query],
              section: fixture.section,
            },
            [fixture.query],
            10
          )
        )
      );
      expect(documents).toMatchObject([
        { section: fixture.section, title: fixture.query },
      ]);
    }
  });

  it("keeps source material searchable until its release model is ready", async () => {
    const t = createConvexTestWithBetterAuth();
    const projection = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(t, [projection]);
    await t.mutation(async (ctx) => {
      await insertRuntimeIndex(ctx, projection.contentKey, {
        headSequence: MATERIAL_IDENTITY.sequence,
        locale: projection.locale,
        plainText: "release owned searchable material",
      });
      await insertContentSearch(ctx, {
        contentHash: "source-material-during-sync",
        description: "",
        locale: projection.locale,
        route: projection.publicPath,
        section: "material",
        sourcePath:
          "material/lesson/mathematics/exponential-logarithm/logarithm-definition",
        syncedAt: 1,
        text: "release owned searchable material",
        title: "Source material during synchronization",
      });
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        throw new Error("Expected one active content state.");
      }
      await ctx.db.patch("contentState", state._id, {
        searchManifestHash: MATERIAL_IDENTITY.manifestHash,
        searchReleaseId: MATERIAL_IDENTITY.releaseId,
        searchSequence: MATERIAL_IDENTITY.sequence,
        materialManifestHash: undefined,
        materialReleaseId: undefined,
        materialSequence: undefined,
      });
    });

    await expect(
      t.query((ctx) =>
        runConvexProgram(
          readContentSearchDocuments(
            ctx,
            {
              limit: 10,
              locale: projection.locale,
              offset: 0,
              queries: ["release owned searchable material"],
              section: "material",
            },
            ["release owned searchable material"],
            10
          )
        )
      )
    ).resolves.toMatchObject([
      {
        section: "material",
        title: "Source material during synchronization",
      },
    ]);

    await t.mutation(async (ctx) => {
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        throw new Error("Expected one active content state.");
      }
      await ctx.db.patch("contentState", state._id, {
        materialManifestHash: MATERIAL_IDENTITY.manifestHash,
        materialReleaseId: MATERIAL_IDENTITY.releaseId,
        materialSequence: MATERIAL_IDENTITY.sequence,
      });
    });

    const documents = await t.query((ctx) =>
      runConvexProgram(
        readContentSearchDocuments(
          ctx,
          {
            limit: 10,
            locale: projection.locale,
            offset: 0,
            queries: [projection.publicPath],
            section: "material",
          },
          [projection.publicPath],
          10
        )
      )
    );

    expect(documents).toMatchObject([
      {
        content_id: projection.graph.assetId,
        route: projection.publicPath,
        section: "material",
        title: projection.metadata.title,
      },
    ]);
  });

  it("resolves exact routes through persisted catalog content IDs", async () => {
    const t = createConvexTestWithBetterAuth();
    const sourcePath =
      "material/lesson/mathematics/exponential-logarithm/logarithm-definition";
    const route = getPublicSearchPath("id", sourcePath);
    const identity = createLearningGraphIdentityFromRoute({
      locale: "id",
      route: sourcePath,
    });

    if (!identity) {
      expect.fail(`Expected graph identity for ${sourcePath}.`);
    }

    const catalogAssetId = `${identity.assetId}:catalog`;
    const catalogGraph = { ...identity, assetId: catalogAssetId };

    await t.mutation(async (ctx) => {
      await ctx.db.insert("contentRoutes", {
        ...catalogGraph,
        authors: [],
        contentHash: "hash-logarithm",
        content_id: catalogAssetId,
        kind: "curriculum-lesson",
        locale: "id",
        markdown: true,
        route,
        section: "material",
        sourcePath,
        syncedAt: 1,
        title: "Definisi Logaritma",
      });
      await ctx.db.insert("contentSearch", {
        ...catalogGraph,
        contentHash: "hash-logarithm",
        content_id: catalogAssetId,
        description: "Memahami bentuk dasar logaritma.",
        locale: "id",
        markdown_url: `https://nakafa.com/id/${route}.md`,
        route,
        section: "material",
        sourcePath,
        syncedAt: 1,
        text: "Definisi Logaritma menjelaskan pangkat yang dibutuhkan.",
        title: "Definisi Logaritma",
        url: `https://nakafa.com/id/${route}`,
      });
    });

    const documents = await t.query((ctx) =>
      runConvexProgram(
        readContentSearchDocuments(
          ctx,
          {
            limit: 1,
            locale: "id",
            offset: 0,
            queries: [route],
            section: "material",
          },
          [route],
          1
        )
      )
    );

    expect(documents.map((document) => document.content_id)).toEqual([
      catalogAssetId,
    ]);
  });

  it("reads discriminating try-out context before a generic title hit", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      await insertContentSearch(ctx, {
        contentHash: "hash-english-section",
        description: "",
        locale: "id",
        route: "try-out/indonesia/snbt/2027/set-2/bahasa-inggris",
        section: "tryout",
        syncedAt: 1,
        text: "bahasa-inggris try-out set-2 reading passage",
        title: "Bahasa Inggris",
      });
      await insertContentSearch(ctx, {
        contentHash: "hash-quantitative-section",
        description: "SMA SNBT Pengetahuan Kuantitatif try out 2026 set 2",
        locale: "id",
        route: "try-out/indonesia/snbt/2027/set-2/pengetahuan-kuantitatif",
        section: "tryout",
        syncedAt: 1,
        text: "pengetahuan-kuantitatif fungsi tangga",
        title: "Pengetahuan Kuantitatif",
      });
    });

    const documents = await t.query((ctx) =>
      runConvexProgram(
        readContentSearchDocuments(
          ctx,
          searchArgs,
          ["SNBT Pengetahuan Kuantitatif try out 2026 set 2"],
          10
        )
      )
    );

    expect(documents[0]?.content_id).toBe(
      searchContentId(
        "id",
        "try-out/indonesia/snbt/2027/set-2/pengetahuan-kuantitatif"
      )
    );
  });

  it("drops a weak try-out hit with only one semantic query token", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      await insertContentSearch(ctx, {
        contentHash: "hash-class-section",
        description: "SMA SNBT Penalaran Umum Try Out 2026 Set 2 Nomor 11",
        locale: "id",
        route: "try-out/indonesia/snbt/2027/set-2/penalaran-umum",
        section: "tryout",
        syncedAt: 1,
        text: "Semua siswa kelas 9 mengikuti ujian sekolah.",
        title: "SNBT Penalaran Umum Try Out 2026 Set 2 Soal 11",
      });
    });

    const documents = await t.query((ctx) =>
      runConvexProgram(
        readContentSearchDocuments(
          ctx,
          searchArgs,
          ["fungsi rasional kelas 11"],
          10
        )
      )
    );

    expect(documents).toEqual([]);
  });
});
