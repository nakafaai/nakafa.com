import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { ACTIVE_APP_LOCALES } from "@nakafa/aksara-contracts/locale";
import { digestQuranRows } from "@nakafa/aksara-contracts/quran/snapshot/digest";
import { makeQuranSnapshot } from "@nakafa/aksara-contracts/quran/snapshot/hash";
import type { QuranRowPayload } from "@nakafa/aksara-contracts/quran/snapshot/row";
import { hashQuranRow } from "@nakafa/aksara-contracts/quran/snapshot/row/hash";
import { quranSourceFileCount } from "@nakafa/aksara-contracts/quran/source";
import {
  QURAN_CHUNK_SIZE,
  QURAN_SURAH_COUNT,
  QURAN_VERSE_COUNT,
} from "@nakafa/aksara-contracts/quran/spec";
import { canonicalizeContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import {
  inheritContentSnapshots,
  replaceContentSnapshot,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import {
  quranRowFacts,
  quranSearchFacts,
} from "@repo/backend/convex/contentRelease/quran/facts";
import { encodeSnapshotJson } from "@repo/backend/convex/contentRelease/wire";
import {
  testEmptyManifest,
  testSignedRelease,
} from "@repo/backend/test/content/proof";
import {
  TEST_DIGEST,
  testPublicationScope,
} from "@repo/backend/test/content/release";
import { makeRuntimeSource } from "@repo/backend/test/content/snapshot";
import {
  makeQuranAttribution,
  makeQuranChunk,
  makeQuranSearch,
  makeQuranSurah,
} from "@repo/backend/test/quran/rows";
import { Effect, Stream } from "effect";

/** Complete synthetic protocol corpus, with authentic row and snapshot hashes. */
export const makeQuranRuntimeSource = Effect.fn(
  "RuntimeSnapshotTest.quranSource"
)(function* () {
  const payloads: QuranRowPayload[] = [makeQuranAttribution()];
  let firstQuranNumber = 1;
  for (let number = 1; number <= QURAN_SURAH_COUNT; number += 1) {
    // Evenly distributed test verses exercise the full bounded protocol, not authored text.
    const verseCount =
      Math.floor(QURAN_VERSE_COUNT / QURAN_SURAH_COUNT) +
      (number <= QURAN_VERSE_COUNT % QURAN_SURAH_COUNT ? 1 : 0);
    payloads.push(makeQuranSurah(number, verseCount));
    for (
      let firstVerse = 1;
      firstVerse <= verseCount;
      firstVerse += QURAN_CHUNK_SIZE
    ) {
      const count = Math.min(QURAN_CHUNK_SIZE, verseCount - firstVerse + 1);
      payloads.push(
        makeQuranChunk({
          firstQuranNumber,
          firstVerse,
          surahNumber: number,
          verseCount: count,
        })
      );
      firstQuranNumber += count;
    }
  }
  for (let number = 1; number <= QURAN_SURAH_COUNT; number += 1) {
    payloads.push(
      ...ACTIVE_APP_LOCALES.map((locale) => makeQuranSearch(locale, number))
    );
  }
  const hashed = yield* Effect.forEach(payloads, (payload) =>
    hashQuranRow(payload).pipe(Effect.map((rowHash) => ({ payload, rowHash })))
  );
  const digest = yield* digestQuranRows({
    activeAppLocales: ACTIVE_APP_LOCALES,
    rows: Stream.fromIterable(hashed),
  });
  const manifest = yield* makeQuranSnapshot({
    ...digest,
    activeAppLocales: ACTIVE_APP_LOCALES,
    provenanceDigest: TEST_DIGEST,
    provenanceStatus: "approved",
    sourceBytes: 1,
    sourceDigest: TEST_DIGEST,
    sourceFileCount: quranSourceFileCount(ACTIVE_APP_LOCALES),
    surahCount: QURAN_SURAH_COUNT,
    tafsirLocales: ["id"],
    verseCount: QURAN_VERSE_COUNT,
  });
  const snapshots = {
    ...inheritContentSnapshots(null),
    quran: replaceContentSnapshot({
      baseSnapshotId: null,
      resultSnapshotId: manifest.snapshotId,
      rowCount: hashed.length,
      rowDigest: manifest.snapshotId,
    }),
  };
  const signed = testSignedRelease({
    ...testEmptyManifest(ReleaseIdSchema.make("quran-active")),
    scope: testPublicationScope({ snapshots }),
    snapshots,
  });
  const fixture = makeRuntimeSource(signed);
  fixture.source.set("contentSnapshots", [
    {
      createdAt: 1,
      family: "quran",
      retainUntil: 100,
      snapshotId: manifest.snapshotId,
      snapshotJson: encodeSnapshotJson({ family: "quran", manifest }),
      verifiedAt: 1,
    },
  ]);
  fixture.source.set(
    "quranRows",
    hashed.map((row, index) => {
      const record = { ...row, snapshotId: manifest.snapshotId };
      return {
        ...quranRowFacts(record),
        index,
        rowHash: record.rowHash,
        rowJson: canonicalizeContentSnapshotRow({ family: "quran", record }),
        snapshotId: manifest.snapshotId,
      };
    })
  );
  fixture.source.set(
    "quranSearch",
    hashed.flatMap((row, index) =>
      row.payload.kind === "quran-search"
        ? [
            {
              ...quranSearchFacts(row.payload),
              index,
              rowHash: row.rowHash,
              snapshotId: manifest.snapshotId,
            },
          ]
        : []
    )
  );
  return { ...fixture, manifest };
});
