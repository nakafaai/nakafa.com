import type { contentSearchInputValidator } from "@repo/backend/convex/contents/helpers/search/schema";
import { readSourceSearchDocuments } from "@repo/backend/convex/contents/helpers/search/source";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import {
  insertContentSearch,
  searchContentId,
} from "@repo/backend/test/search";
import type { Infer } from "convex/values";
import { describe, expect, it } from "vitest";

const searchArgs: Infer<typeof contentSearchInputValidator> = {
  limit: 10,
  locale: "id",
  offset: 0,
  section: "tryout",
};

describe("readSourceSearchDocuments", () => {
  it("reads discriminating try-out context before a generic title hit", async () => {
    const target = createConvexTestWithBetterAuth();
    await target.mutation(async (ctx) => {
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

    const documents = await target.query((ctx) =>
      runConvexProgram(
        readSourceSearchDocuments(
          ctx,
          searchArgs,
          ["SNBT Pengetahuan Kuantitatif try out 2026 set 2"],
          10,
          ["tryout"]
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
    const target = createConvexTestWithBetterAuth();
    await target.mutation(async (ctx) => {
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

    const documents = await target.query((ctx) =>
      runConvexProgram(
        readSourceSearchDocuments(
          ctx,
          searchArgs,
          ["fungsi rasional kelas 11"],
          10,
          ["tryout"]
        )
      )
    );

    expect(documents).toEqual([]);
  });
});
