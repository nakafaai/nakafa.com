import { readContentSearchDocuments } from "@repo/backend/convex/contents/helpers/search/read";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { makeMaterialProjection } from "@repo/backend/test/content-material";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content-runtime";
import {
  activateMaterialCatalog,
  insertMaterialProjection,
  MATERIAL_IDENTITY,
  selectExactMaterial,
} from "@repo/backend/test/material-catalog";
import { insertRuntimeIndex } from "@repo/backend/test/runtime-head";
import { TEST_RUNTIME_RELEASE } from "@repo/backend/test/runtime-values";
import {
  getPublicSearchPath,
  insertContentSearch,
} from "@repo/backend/test/search";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { describe, expect, it } from "vitest";

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
        expect.fail("Expected one active content state.");
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

  it("fills an empty article family from searchable materials", async () => {
    const t = createConvexTestWithBetterAuth();
    const projections = Array.from({ length: 25 }, (_, index) =>
      makeMaterialProjection("en", index + 1)
    );

    await t.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, 0);
      for (const projection of projections) {
        await insertMaterialProjection(ctx, projection, TEST_RUNTIME_RELEASE);
        await insertRuntimeIndex(ctx, projection.contentKey, {
          headSequence: TEST_RUNTIME_RELEASE.sequence,
          locale: projection.locale,
          plainText: "saturated published material",
        });
      }
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        expect.fail("Expected one active content state.");
      }
      await ctx.db.patch("contentState", state._id, {
        materialManifestHash: TEST_RUNTIME_RELEASE.manifestHash,
        materialOwnerManifestHash: TEST_RUNTIME_RELEASE.manifestHash,
        materialOwnerReleaseId: TEST_RUNTIME_RELEASE.releaseId,
        materialOwnerSequence: TEST_RUNTIME_RELEASE.sequence,
        materialReleaseId: TEST_RUNTIME_RELEASE.releaseId,
        materialSequence: TEST_RUNTIME_RELEASE.sequence,
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
            limit: 20,
            locale: "en",
            offset: 0,
            queries: ["saturated published material"],
          },
          ["saturated published material"],
          21
        )
      )
    );

    expect(documents).toHaveLength(21);
    expect(documents.every((document) => document.section === "material")).toBe(
      true
    );
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
        materialOwnerManifestHash: undefined,
        materialOwnerReleaseId: undefined,
        materialOwnerSequence: undefined,
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
        materialOwnerManifestHash: MATERIAL_IDENTITY.manifestHash,
        materialOwnerReleaseId: MATERIAL_IDENTITY.releaseId,
        materialOwnerSequence: MATERIAL_IDENTITY.sequence,
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

  it("replaces one stale source result through exact material ownership", async () => {
    const t = createConvexTestWithBetterAuth();
    const projection = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(t, [projection]);
    await selectExactMaterial(t, projection);
    await t.mutation(async (ctx) => {
      await insertRuntimeIndex(ctx, projection.contentKey, {
        headSequence: MATERIAL_IDENTITY.sequence,
        locale: projection.locale,
        plainText: "exact owned searchable material",
      });
      await insertContentSearch(ctx, {
        contentHash: "stale-exact-material",
        description: "",
        locale: projection.locale,
        route: "subjects/test/technical-topic/old-section",
        section: "material",
        sourcePath: projection.contentKey,
        syncedAt: 1,
        text: "exact owned searchable material",
        title: "Stale exact source material",
      });
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        throw new Error("Expected one active content state.");
      }
      await ctx.db.patch("contentState", state._id, {
        searchManifestHash: MATERIAL_IDENTITY.manifestHash,
        searchReleaseId: MATERIAL_IDENTITY.releaseId,
        searchSequence: MATERIAL_IDENTITY.sequence,
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
              queries: ["exact owned searchable material"],
              section: "material",
            },
            ["exact owned searchable material"],
            10
          )
        )
      )
    ).resolves.toMatchObject([
      {
        content_id: projection.graph.assetId,
        route: projection.publicPath,
        section: "material",
        title: projection.metadata.title,
      },
    ]);
  });

  it("fills the requested source window after removing exact claims", async () => {
    const t = createConvexTestWithBetterAuth();
    const projection = makeMaterialProjection("en", 1);
    await activateMaterialCatalog(t, [projection]);
    await selectExactMaterial(t, projection);
    await t.mutation(async (ctx) => {
      await insertRuntimeIndex(ctx, projection.contentKey, {
        headSequence: MATERIAL_IDENTITY.sequence,
        locale: projection.locale,
        plainText: "claimed source material",
      });
      await insertContentSearch(ctx, {
        contentHash: "claimed-source-first",
        description: "",
        locale: projection.locale,
        route: projection.publicPath,
        section: "material",
        sourcePath: projection.contentKey,
        syncedAt: 1,
        text: "claimed source material",
        title: "A claimed material",
      });
      await insertContentSearch(ctx, {
        contentHash: "unclaimed-source-second",
        description: "",
        locale: projection.locale,
        route: "subjects/mathematics/logarithms/definition",
        section: "material",
        sourcePath:
          "material/lesson/mathematics/exponential-logarithm/logarithm-definition",
        syncedAt: 1,
        text: "unclaimed source material",
        title: "B unclaimed material",
      });
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        expect.fail("Expected one active content state.");
      }
      await ctx.db.patch("contentState", state._id, {
        searchManifestHash: MATERIAL_IDENTITY.manifestHash,
        searchReleaseId: MATERIAL_IDENTITY.releaseId,
        searchSequence: MATERIAL_IDENTITY.sequence,
      });
    });

    const documents = await t.query((ctx) =>
      runConvexProgram(
        readContentSearchDocuments(
          ctx,
          {
            limit: 2,
            locale: projection.locale,
            offset: 0,
            queries: [],
            section: "material",
          },
          [],
          2
        )
      )
    );

    expect(documents).toMatchObject([
      {
        route: projection.publicPath,
        section: "material",
      },
      { section: "material", title: "B unclaimed material" },
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
});
