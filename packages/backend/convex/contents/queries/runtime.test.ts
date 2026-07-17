import { api } from "@repo/backend/convex/_generated/api";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { describe, expect, it } from "vitest";

describe("contents/queries/runtime", () => {
  it("loads one surah metadata row without requiring verse rows", async () => {
    const t = createConvexTestWithBetterAuth();

    await t.mutation(async (ctx) => {
      await ctx.db.insert("quranSurahs", {
        contentHash: "surah-1",
        name: {
          long: "Surah Al-Fatihah",
          short: "الفاتحة",
          transliteration: { en: "Al-Faatiha", id: "Al-Fatihah" },
          translation: { en: "The Opening", id: "Pembukaan" },
        },
        number: 1,
        numberOfVerses: 7,
        preBismillah: null,
        revelation: { arab: "مكية", en: "Meccan", id: "Makkiyah" },
        sequence: 5,
        syncedAt: 1,
      });
    });

    const metadata = await t.query(
      api.contents.queries.runtime.getQuranSurahMetadata,
      { surah: 1 }
    );
    const missing = await t.query(
      api.contents.queries.runtime.getQuranSurahMetadata,
      { surah: 2 }
    );

    expect(metadata).toMatchObject({
      name: { translation: { id: "Pembukaan" } },
      number: 1,
      numberOfVerses: 7,
    });
    expect(missing).toBeNull();
  });
});
