import {
  DatabaseReader as ConfectDatabaseReader,
  RegisteredConvexFunction,
} from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { loadSearchOwner } from "@repo/backend/confect/contentRelease/search/owner";
import { readPublishedSearchDocuments } from "@repo/backend/confect/contents/search/published";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content/runtime";
import {
  activateMaterialCatalog,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material/catalog";
import { insertRuntimeIndex } from "@repo/backend/test/runtime/head";
import { TEST_RUNTIME_RELEASE } from "@repo/backend/test/runtime/values";
import { Array as Arr, Effect, Order } from "effect";

/** Reads one published article window through the production owner boundary. */
function readArticles(
  t: ReturnType<typeof createConvexTestWithBetterAuth>,
  queries: readonly string[],
  scanLimit: number
) {
  return t.query(async (ctx) => {
    const owner = await Effect.runPromise(
      loadSearchOwner().pipe(
        Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
      )
    );
    if (!owner) {
      throw new Error("Expected one active search owner.");
    }
    return Effect.runPromise(
      readPublishedSearchDocuments(
        {
          limit: scanLimit,
          locale: "en",
          offset: 0,
          queries: [...queries],
          section: "articles",
        },
        queries,
        scanLimit,
        owner,
        ["article"]
      ).pipe(Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db)))
    );
  });
}

/** Activates the release-owned search identity used by published read tests. */
async function activateSearch(
  t: ReturnType<typeof createConvexTestWithBetterAuth>
) {
  await t.mutation(async (ctx) => {
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
}
describe("readPublishedSearchDocuments", () => {
  it("keeps smaller pages stable across empty and overlapping queries", async () => {
    const t = createConvexTestWithBetterAuth();
    const queries = [
      "/",
      "articles/no-such-route",
      "missing",
      "alpha",
      "beta",
      "gamma",
    ];
    const texts = Array.from(
      {
        length: 20,
      },
      (_, index) =>
        index < 10 ? "alpha beta bounded search" : "gamma bounded search"
    );
    await t.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, texts.length);
      const indexRows = Arr.map(texts, (plainText, index) => ({
        contentKey: testArticleProjection(index).contentKey,
        plainText,
      }));
      for (const { contentKey, plainText } of indexRows) {
        await insertRuntimeIndex(ctx, contentKey, { plainText });
      }
    });
    await activateSearch(t);
    const firstPage = await readArticles(t, queries, 2);
    const fullWindow = await readArticles(t, queries, 4);
    expect(firstPage).toHaveLength(2);
    expect(firstPage).toEqual(Arr.take(fullWindow, firstPage.length));
    expect(
      Arr.dedupe(Arr.map(fullWindow, (document) => document.content_id)).length
    ).toBe(fullWindow.length);
  });
  it("fills the window when an exact route repeats in search hits", async () => {
    const t = createConvexTestWithBetterAuth();
    const exact = testArticleProjection(0);
    await t.mutation(async (ctx) => {
      await insertRuntimeArticles(ctx, 4);
      for (let index = 0; index < 4; index += 1) {
        const projection = testArticleProjection(index);
        await insertRuntimeIndex(ctx, projection.contentKey, {
          plainText: `${exact.publicPath} related article`,
        });
      }
    });
    await activateSearch(t);
    const documents = await readArticles(t, [exact.publicPath], 3);
    expect(documents).toHaveLength(3);
    expect(documents[0]?.content_id).toBe(exact.graph.assetId);
    expect(
      Arr.dedupe(Arr.map(documents, (document) => document.content_id)).length
    ).toBe(documents.length);
  });
  it("browses current materials in stable public-path order", async () => {
    const t = createConvexTestWithBetterAuth();
    const projections = Array.from(
      {
        length: 40,
      },
      (_, index) => makeMaterialProjection("en", 1, index + 1)
    );
    await t.mutation((ctx) =>
      Effect.runPromise(
        activateMaterialCatalog(projections).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
    await t.mutation(async (ctx) => {
      for (const projection of projections) {
        await insertRuntimeIndex(ctx, projection.contentKey, {
          artifactLocale: projection.artifactLocale,
          headSequence: MATERIAL_IDENTITY.sequence,
          plainText: "bounded published material",
        });
      }
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
    const documents = await t.query(async (ctx) => {
      const owner = await Effect.runPromise(
        loadSearchOwner().pipe(
          Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
        )
      );
      if (!owner) {
        expect.fail("Expected one active search owner.");
      }
      return Effect.runPromise(
        readPublishedSearchDocuments(
          {
            limit: 2,
            locale: "en",
            offset: 0,
            queries: [],
            section: "material",
          },
          [],
          2,
          owner,
          ["material"]
        ).pipe(
          Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
        )
      );
    });
    const expected = Arr.take(
      Arr.sort(
        Arr.map(projections, ({ publicPath }) => publicPath),
        Order.String
      ),
      2
    );
    expect(Arr.map(documents, ({ route }) => route)).toEqual(expected);
  });
});
it("keeps the signed description in published search documents", async () => {
  const t = createConvexTestWithBetterAuth();
  await t.mutation((ctx) =>
    insertRuntimeArticles(ctx, 1, (index) => {
      const projection = testArticleProjection(index);
      return {
        ...projection,
        metadata: {
          ...projection.metadata,
          description: "Signed summary",
        },
      };
    })
  );
  await t.mutation((ctx) =>
    insertRuntimeIndex(ctx, testArticleProjection(0).contentKey, {
      plainText: "article",
    })
  );
  await activateSearch(t);
  expect(await readArticles(t, ["article"], 10)).toMatchObject([
    {
      description: "Signed summary",
    },
  ]);
});
