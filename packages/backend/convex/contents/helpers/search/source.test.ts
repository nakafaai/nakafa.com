import type { contentSearchInputValidator } from "@repo/backend/convex/contents/helpers/search/schema";
import { readSourceSearchDocuments } from "@repo/backend/convex/contents/helpers/search/source";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { insertContentSearch } from "@repo/backend/test/search";
import { testTryoutGraph } from "@repo/backend/test/tryouts";
import type { Infer } from "convex/values";
import { describe, expect, it } from "vitest";

const searchArgs: Infer<typeof contentSearchInputValidator> = {
  limit: 10,
  locale: "id",
  offset: 0,
  section: "tryout",
};

/** Derives one signed SNBT section identity from its stable source key. */
function snbtSectionGraph(sectionKey: string) {
  return testTryoutGraph({
    countryKey: "indonesia",
    examKey: "snbt",
    kind: "section",
    sectionKey,
    setKey: "set-2",
    trackKey: "2027",
  });
}

describe("readSourceSearchDocuments", () => {
  it("reads discriminating try-out context before a generic title hit", async () => {
    const target = createConvexTestWithBetterAuth();
    await target.mutation(async (ctx) => {
      await insertContentSearch(ctx, {
        contentHash: "hash-english-section",
        description: "",
        graph: snbtSectionGraph("english-language"),
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
        graph: snbtSectionGraph("quantitative-knowledge"),
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
          ["tryout"],
          []
        )
      )
    );

    expect(documents[0]?.content_id).toBe(
      snbtSectionGraph("quantitative-knowledge").assetId
    );
  });

  it("drops a weak try-out hit with only one semantic query token", async () => {
    const target = createConvexTestWithBetterAuth();
    await target.mutation(async (ctx) => {
      await insertContentSearch(ctx, {
        contentHash: "hash-class-section",
        description: "SMA SNBT Penalaran Umum Try Out 2026 Set 2 Nomor 11",
        graph: snbtSectionGraph("general-reasoning"),
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
          ["tryout"],
          []
        )
      )
    );

    expect(documents).toEqual([]);
  });

  it.each([
    { queryTexts: [], source: "browse" },
    { queryTexts: ["bounded material browse"], source: "text search" },
  ])(
    "refills the $source window after exact material claims",
    async ({ queryTexts }) => {
      const target = createConvexTestWithBetterAuth();
      const sourcePaths = Array.from(
        { length: 44 },
        (_, index) =>
          `material/lesson/mathematics/search-window/lesson-${String(index).padStart(2, "0")}`
      );
      await target.mutation(async (ctx) => {
        for (const [index, sourcePath] of sourcePaths.entries()) {
          await insertContentSearch(ctx, {
            contentHash: `hash-material-${index}`,
            description: "",
            locale: "en",
            route: sourcePath,
            section: "material",
            sourcePath,
            syncedAt: 1,
            text: "bounded material browse",
            title: `Material ${String(index).padStart(2, "0")}`,
          });
        }
      });

      const documents = await target.query((ctx) =>
        runConvexProgram(
          readSourceSearchDocuments(
            ctx,
            {
              limit: 32,
              locale: "en",
              offset: 0,
              section: "material",
            },
            queryTexts,
            32,
            ["material"],
            sourcePaths.slice(0, 12).map((contentKey) => ({
              contentKey,
              locale: "en",
            }))
          )
        )
      );

      expect(documents).toHaveLength(32);
      expect(documents[0]?.sourcePath).toBe(sourcePaths[12]);
      expect(documents.at(-1)?.sourcePath).toBe(sourcePaths[43]);
    }
  );
});
