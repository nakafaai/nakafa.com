import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { bindQuranRow } from "@nakafa/aksara-contracts/quran/snapshot/row-hash";
import {
  quranRowFacts,
  quranSearchFacts,
} from "@repo/backend/convex/contentRelease/quran/facts";
import {
  makeQuranAttribution,
  makeQuranChunk,
  makeQuranSearch,
  makeQuranSurah,
} from "@repo/backend/test/quran-rows";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const snapshotId = Sha256HashSchema.make(`sha256:${"2".repeat(64)}`);

describe("contentRelease/quran/facts", () => {
  it("derives the exact indexed facts for every Quran row kind", async () => {
    const search = makeQuranSearch("id", 1, "pencarian teknis");
    const payloads = [
      makeQuranAttribution(),
      makeQuranSurah(1, 2),
      makeQuranChunk({
        firstQuranNumber: 1,
        firstVerse: 1,
        surahNumber: 1,
        verseCount: 2,
      }),
      search,
    ];
    const records = await Effect.runPromise(
      Effect.forEach(payloads, (payload) => bindQuranRow(snapshotId, payload))
    );

    expect(records.map(quranRowFacts)).toEqual([
      {
        identity:
          "attribution:tanzil-text:tanzil-metadata:quranenc-english:quranenc-indonesian:quranenc-tafsir",
        kind: "quran-attribution",
      },
      { identity: "surah:1", kind: "quran-surah", surahNumber: 1 },
      {
        firstVerse: 1,
        identity: "chunk:1:1",
        kind: "quran-chunk",
        surahNumber: 1,
      },
      {
        appLocale: "id",
        identity: "search:id:1",
        kind: "quran-search",
        surahNumber: 1,
      },
    ]);
    expect(quranSearchFacts(search)).toEqual({
      appLocale: "id",
      assetId: "asset:id:quran:quran-surah:1",
      identity: "search:id:1",
      surahNumber: 1,
      text: "pencarian teknis",
    });
  });
});
