// @vitest-environment node
import { describe, expect, it } from "@effect/vitest";
import { makeQuranSurah } from "@repo/backend/test/quran/rows";
import { Effect } from "effect";
import {
  getPublishedQuranCatalog,
  getPublishedQuranView,
} from "@/lib/content/quran/publication";
import { recoverStalePublishedQuranSnapshot } from "@/lib/content/quran/recovery";
import {
  readSurahHandler,
  recoverQuranSnapshotHandler,
} from "@/lib/content/quran/surah.server";
import { viewResult } from "@/test/quran";

vi.mock("@tanstack/react-start/server", () => ({
  getRequest: () => new Request("https://nakafa.com/en/quran/1"),
}));

const messages = {
  Common: { home: "Home", more: "More" },
  Holy: {
    interpretation: "Interpretation",
    quran: "Quran",
    "translation-notes": "Translation notes",
    verse: "Verse",
    "verse-count": "Verse {count}",
  },
};

vi.mock("@repo/internationalization/src/messages", () => ({
  loadLocaleMessages: vi.fn(() => Promise.resolve(messages)),
}));

vi.mock("@/lib/seo/generator", () => ({
  generateSEOMetadata: vi.fn(() =>
    Effect.succeed({ description: "Surah description" })
  ),
}));

let catalogSurahs = [makeQuranSurah(1)];

/** The published view of surah 1: the decoded surah name carries its meaning by locale. */
function publishedView() {
  return { ...viewResult(), surah: makeQuranSurah(1) };
}

/** The view the next read answers with, when a test names one. */
let nextView: ReturnType<typeof publishedView> | null = null;

vi.mock("@/lib/content/quran/publication", () => ({
  getPublishedQuranCatalog: vi.fn(() =>
    Promise.resolve({ surahs: catalogSurahs })
  ),
  getPublishedQuranView: vi.fn(() =>
    Promise.resolve(nextView ?? publishedView())
  ),
}));

vi.mock("@/lib/content/quran/recovery", () => ({
  recoverStalePublishedQuranSnapshot: vi.fn(() =>
    Effect.succeed({ recovered: true })
  ),
}));

describe("surah route read", () => {
  it("answers not found for a route that names no surah number", async () => {
    await expect(
      readSurahHandler({ data: { locale: "en", surah: "first" } })
    ).resolves.toStrictEqual({ kind: "notFound" });
    expect(getPublishedQuranCatalog).not.toHaveBeenCalled();
  });

  it("answers not found for a surah that the catalog does not hold", async () => {
    catalogSurahs = [];
    await expect(
      readSurahHandler({ data: { locale: "en", surah: "1" } })
    ).resolves.toStrictEqual({ kind: "notFound" });
    expect(getPublishedQuranView).not.toHaveBeenCalled();
    catalogSurahs = [makeQuranSurah(1)];
  });

  it("reads the surah with its verses and hides the bismillah when none is published", async () => {
    const result = await readSurahHandler({
      data: { locale: "en", surah: "1" },
    });
    expect(result).toMatchObject({
      book: { position: 1 },
      description: "Surah description",
      kind: "found",
      locale: "en",
      preBismillah: { kind: "hidden" },
      surah: "1",
      surahNumber: 1,
    });
    expect(getPublishedQuranView).toHaveBeenCalledWith("en", 1);
  });

  it("shows the bismillah of the surah when the publication names one", async () => {
    const withBismillah = {
      ...publishedView(),
      preBismillah: {
        arabic: "بسم",
        translation: {
          notes: [],
          segments: [{ kind: "text", offset: 0, value: "In the name" }],
        },
      },
    };
    nextView = withBismillah;
    await expect(
      readSurahHandler({ data: { locale: "en", surah: "1" } })
    ).resolves.toMatchObject({
      kind: "found",
      preBismillah: {
        kind: "shown",
        value: {
          arabic: "بسم",
          translation: {
            notes: [],
            segments: [{ kind: "text", offset: 0, value: "In the name" }],
          },
        },
      },
    });
    nextView = null;
  });
});

describe("surah snapshot recovery", () => {
  it("answers the recovery of the stale snapshot that the reader names", async () => {
    const snapshotId = `sha256:${"d".repeat(64)}`;
    await expect(
      recoverQuranSnapshotHandler({ data: { snapshotId } })
    ).resolves.toStrictEqual({ recovered: true });
    expect(recoverStalePublishedQuranSnapshot).toHaveBeenCalledWith(snapshotId);
  });
});
