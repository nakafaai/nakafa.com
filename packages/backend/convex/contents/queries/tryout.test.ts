import { api } from "@repo/backend/convex/_generated/api";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  insertContentSearch,
  searchContentId,
} from "@repo/backend/test/search";
import { describe, expect, it } from "vitest";

describe("contents/queries/search:tryout", () => {
  it("prioritizes try-out context over generic section titles", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      await insertContentSearch(ctx, {
        contentHash: "hash-english-section",
        description: "",
        locale: "id",
        route: "try-out/indonesia/snbt/2027/set-2/english-language",
        section: "tryout",
        syncedAt: 1,
        text: "english-language try-out set-2 reading passage",
        title: "Bahasa Inggris",
      });
      await insertContentSearch(ctx, {
        contentHash: "hash-quantitative-section",
        description: "SMA SNBT Pengetahuan Kuantitatif try out 2026 set 2",
        locale: "id",
        route: "try-out/indonesia/snbt/2027/set-2/quantitative-knowledge",
        section: "tryout",
        syncedAt: 1,
        text: "quantitative-knowledge Pengetahuan Kuantitatif try-out try out 2026 set-2 set 2 fungsi tangga",
        title: "Pengetahuan Kuantitatif",
      });
    });

    const result = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      queries: ["SNBT Pengetahuan Kuantitatif try out 2026 set 2"],
      section: "tryout",
    });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        content_id: searchContentId(
          "id",
          "try-out/indonesia/snbt/2027/set-2/quantitative-knowledge"
        ),
      })
    );
  });

  it("prefers metadata-matching try-out section rows over generic body hits", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      await insertContentSearch(ctx, {
        contentHash: "hash-language-section",
        description: "",
        locale: "id",
        route: "try-out/indonesia/snbt/2027/set-1/indonesian-language",
        section: "tryout",
        syncedAt: 1,
        text: "Bagian bacaan yang menyebut pola bilangan sebagai contoh.",
        title: "Bahasa Indonesia",
      });
      await insertContentSearch(ctx, {
        contentHash: "hash-math-section",
        description: "SNBT Penalaran Matematika Try Out 2026 Set 1 20 soal",
        locale: "id",
        route: "try-out/indonesia/snbt/2027/set-1/mathematical-reasoning",
        section: "tryout",
        syncedAt: 1,
        text: "Latihan pola bilangan untuk penalaran matematika.",
        title: "SNBT Penalaran Matematika Try Out 2026 Set 1",
      });
    });

    const result = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      queries: ["pola bilangan penalaran matematika"],
      section: "tryout",
    });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        content_id: searchContentId(
          "id",
          "try-out/indonesia/snbt/2027/set-1/mathematical-reasoning"
        ),
      })
    );
  });

  it("does not let grade numbers dominate try-out topic searches", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      await insertContentSearch(ctx, {
        contentHash: "hash-general-reasoning-section",
        description: "SMA SNBT Penalaran Umum Try Out 2026 Set 2 Nomor 11",
        locale: "id",
        route: "try-out/indonesia/snbt/2027/set-2/general-reasoning",
        section: "tryout",
        syncedAt: 1,
        text: "Bagian umum nomor 11.",
        title: "SNBT Penalaran Umum Try Out 2026 Set 2",
      });
      await insertContentSearch(ctx, {
        contentHash: "hash-rational-section",
        description: "SMA TKA Matematika Try Out 2026 Set 1 20 soal",
        locale: "id",
        route: "try-out/indonesia/tka/mathematics/set-1",
        section: "tryout",
        syncedAt: 1,
        text: "Latihan fungsi rasional kelas 11.",
        title: "TKA Matematika Try Out 2026 Set 1",
      });
    });

    const result = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      queries: ["fungsi rasional kelas 11"],
      section: "tryout",
    });

    expect(result.items[0]).toEqual(
      expect.objectContaining({
        content_id: searchContentId(
          "id",
          "try-out/indonesia/tka/mathematics/set-1"
        ),
      })
    );
  });

  it("drops weak try-out hits when only one semantic query token matches", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      await insertContentSearch(ctx, {
        contentHash: "hash-class-section",
        description: "SMA SNBT Penalaran Umum Try Out 2026 Set 2 Nomor 11",
        locale: "id",
        route: "try-out/indonesia/snbt/2027/set-2/general-reasoning",
        section: "tryout",
        syncedAt: 1,
        text: "Semua siswa kelas 9 mengikuti ujian sekolah.",
        title: "SNBT Penalaran Umum Try Out 2026 Set 2 Soal 11",
      });
    });

    const result = await t.query(api.contents.queries.search.search, {
      limit: 10,
      locale: "id",
      offset: 0,
      queries: ["fungsi rasional kelas 11"],
      section: "tryout",
    });

    expect(result.items).toEqual([]);
  });
});
