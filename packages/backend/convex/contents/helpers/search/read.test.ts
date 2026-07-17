import { readContentSearchDocuments } from "@repo/backend/convex/contents/helpers/search/read";
import type { contentSearchInputValidator } from "@repo/backend/convex/contents/helpers/search/schema";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
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
        0
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
      readContentSearchDocuments(
        ctx,
        searchArgs,
        ["SNBT Pengetahuan Kuantitatif try out 2026 set 2"],
        10
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
      readContentSearchDocuments(
        ctx,
        searchArgs,
        ["fungsi rasional kelas 11"],
        10
      )
    );

    expect(documents).toEqual([]);
  });
});
