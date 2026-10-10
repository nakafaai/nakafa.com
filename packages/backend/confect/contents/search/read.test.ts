import {
  DatabaseReader as ConfectDatabaseReader,
  RegisteredConvexFunction,
} from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { readContentSearchDocuments } from "@repo/backend/confect/contents/search/read";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content/runtime";
import {
  activateMaterialCatalog,
  insertMaterialProjection,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material/catalog";
import { insertRuntimeIndex } from "@repo/backend/test/runtime/head";
import { TEST_RUNTIME_RELEASE } from "@repo/backend/test/runtime/values";
import { NAKAFA_AGENT_SEARCH_WINDOW } from "@repo/contents/agent/search";
import { Array as Arr, Effect } from "effect";

describe("readContentSearchDocuments", () => {
  it("reads searchable articles only from the active signed projection", async () => {
    const t = createConvexTestWithBetterAuth();
    const projection = testArticleProjection(0);
    await t.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, 1);
      await insertRuntimeIndex(ctx, projection.contentKey, {
        plainText: "release owned searchable article",
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
      Effect.runPromise(
        readContentSearchDocuments(
          {
            limit: 10,
            locale: "en",
            offset: 0,
            queries: ["release owned searchable article"],
            section: "articles",
          },
          ["release owned searchable article"],
          10
        ).pipe(
          Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
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
  it("fills an unscoped search window from current signed materials", async () => {
    const t = createConvexTestWithBetterAuth();
    const projections = Array.from(
      {
        length: 25,
      },
      (_, index) => makeMaterialProjection("en", index + 1)
    );
    await t.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, 0);
      for (const projection of projections) {
        await Effect.runPromise(
          insertMaterialProjection(projection, TEST_RUNTIME_RELEASE).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        );
        await insertRuntimeIndex(ctx, projection.contentKey, {
          artifactLocale: projection.artifactLocale,
          headSequence: TEST_RUNTIME_RELEASE.sequence,
          plainText: "saturated published material",
        });
      }
      const state = await ctx.db.query("contentState").unique();
      if (!state) {
        expect.fail("Expected one active content state.");
      }
      await ctx.db.patch("contentState", state._id, {
        materialManifestHash: TEST_RUNTIME_RELEASE.manifestHash,
        materialReleaseId: TEST_RUNTIME_RELEASE.releaseId,
        materialSequence: TEST_RUNTIME_RELEASE.sequence,
        searchManifestHash: TEST_RUNTIME_RELEASE.manifestHash,
        searchReleaseId: TEST_RUNTIME_RELEASE.releaseId,
        searchSequence: TEST_RUNTIME_RELEASE.sequence,
      });
    });
    const documents = await t.query((ctx) =>
      Effect.runPromise(
        readContentSearchDocuments(
          {
            limit: NAKAFA_AGENT_SEARCH_WINDOW,
            locale: "en",
            offset: 0,
            queries: ["saturated published material"],
          },
          ["saturated published material"],
          NAKAFA_AGENT_SEARCH_WINDOW
        ).pipe(
          Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
        )
      )
    );
    expect(documents).toHaveLength(NAKAFA_AGENT_SEARCH_WINDOW);
    expect(
      Arr.every(documents, (document) => document.section === "material")
    ).toBe(true);
  });
  it("resolves exact route queries through current catalog identities", async () => {
    const t = createConvexTestWithBetterAuth();
    const projection = makeMaterialProjection("en", 1);
    await t.mutation((ctx) =>
      Effect.runPromise(
        activateMaterialCatalog([projection]).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    await t.mutation(async (ctx) => {
      await insertRuntimeIndex(ctx, projection.contentKey, {
        artifactLocale: projection.artifactLocale,
        headSequence: MATERIAL_IDENTITY.sequence,
        plainText: "current signed material",
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
      Effect.runPromise(
        readContentSearchDocuments(
          {
            limit: 1,
            locale: "en",
            offset: 0,
            queries: [projection.publicPath],
            section: "material",
          },
          [projection.publicPath],
          1
        ).pipe(
          Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
        )
      )
    );
    expect(documents).toMatchObject([
      {
        content_id: projection.graph.assetId,
        route: projection.publicPath,
        section: "material",
      },
    ]);
  });
  it("returns no published documents without an active search owner", async () => {
    const t = createConvexTestWithBetterAuth();
    await expect(
      t.query((ctx) =>
        Effect.runPromise(
          readContentSearchDocuments(
            {
              limit: 1,
              locale: "en",
              offset: 0,
              queries: ["missing"],
              section: "articles",
            },
            ["missing"],
            1
          ).pipe(
            Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
          )
        )
      )
    ).resolves.toEqual([]);
  });
});
