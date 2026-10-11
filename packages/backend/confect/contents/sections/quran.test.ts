import { RegisteredConvexFunction } from "@confect/server";
import { describe, expect, it } from "@effect/vitest";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { readSurah } from "@repo/backend/confect/contents/sections/quran";
import { createConvexTestWithBetterAuth } from "@repo/backend/confect/test.helpers";
import { TEST_RELEASE_ID } from "@repo/backend/test/content/release";
import { makeQuranChunk, makeQuranSurah } from "@repo/backend/test/quran/rows";
import {
  activateQuranSnapshot,
  activateQuranSource,
} from "@repo/backend/test/quran/snapshot";
import { Array as Arr, Effect } from "effect";

function setup() {
  const t = createConvexTestWithBetterAuth();
  const read = (input: Parameters<typeof readSurah>[0]) =>
    t.mutation((ctx) =>
      Effect.runPromise(
        readSurah(input).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      )
    );
  return { read, t };
}

describe("section Quran passages", () => {
  it("reads one passage per signed chunk of verses and language", async () => {
    const { read, t } = setup();
    await t.mutation((ctx) =>
      activateQuranSnapshot(ctx, [
        makeQuranSurah(1, 7),
        makeQuranChunk({
          firstQuranNumber: 1,
          firstVerse: 1,
          surahNumber: 1,
          translationFootnotes: { en: "[1] Reviewed English note." },
          translationText: { en: "Praise be to God.[1]" },
          verseCount: 6,
        }),
        makeQuranChunk({
          firstQuranNumber: 7,
          firstVerse: 7,
          surahNumber: 1,
          verseCount: 1,
        }),
      ])
    );
    const result = await read({ releaseId: TEST_RELEASE_ID, surah: 1 });
    if (result.kind !== "surah") {
      throw new Error("Expected the passages of the surah.");
    }
    expect(result.releaseId).toBe(TEST_RELEASE_ID);
    expect(
      Arr.map(
        result.sections,
        ({ anchor, appLocale, count, ordinal }) =>
          `${appLocale} ${anchor} ${ordinal}/${count}`
      )
    ).toEqual([
      "en verse-1 0/2",
      "en verse-7 1/2",
      "id verse-1 0/2",
      "id verse-7 1/2",
      "de verse-1 0/2",
      "de verse-7 1/2",
    ]);
    const indonesian = result.sections[2];
    expect(indonesian).toMatchObject({
      contentKey: "quran/1",
      headingPath: ["Technical Surah 1 (surah 1)", "Verses 1-6"],
      publicPath: "quran/1",
      section: "quran",
    });
    expect(indonesian?.text).toBe(
      Arr.join(
        [
          "Technical Surah 1: Arti teknis 1",
          "Technical Surah 1 (surah 1) > Verses 1-6",
          "1. آية 1",
          "Terjemahan teknis 1",
          "Tafsir teknis 1",
          "2. آية 2",
          "Terjemahan teknis 2",
          "Tafsir teknis 2",
          "3. آية 3",
          "Terjemahan teknis 3",
          "Tafsir teknis 3",
          "4. آية 4",
          "Terjemahan teknis 4",
          "Tafsir teknis 4",
          "5. آية 5",
          "Terjemahan teknis 5",
          "Tafsir teknis 5",
          "6. آية 6",
          "Terjemahan teknis 6",
          "Tafsir teknis 6",
        ],
        "\n"
      )
    );
    const english = result.sections[0];
    expect(english?.text).toContain("1. آية 1\nPraise be to God.\n2. آية 2");
    expect(english?.text).not.toContain("Tafsir");
    expect(english?.text).not.toContain("[1]");
    expect(english?.text).not.toContain("Reviewed English note");
  });

  it("finds no passages when the active release has no Quran", async () => {
    const { read, t } = setup();
    await t.mutation(activateQuranSource);
    expect(await read({ surah: 1 })).toEqual({
      kind: "none",
      releaseId: TEST_RELEASE_ID,
    });
  });

  it("is stale when the build began for another release", async () => {
    const { read, t } = setup();
    await t.mutation(activateQuranSource);
    expect(await read({ releaseId: "release-earlier", surah: 1 })).toEqual({
      kind: "stale",
    });
  });

  it("is stale while no release is active", async () => {
    const { read } = setup();
    expect(await read({ surah: 1 })).toEqual({ kind: "stale" });
  });
});
