import { expect, it } from "@effect/vitest";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { QuranPublicationError } from "@repo/backend/client/quran/publication";
import {
  decodeQuranChunkVerses,
  decodeQuranSearchRow,
} from "@repo/backend/client/quran/rows";
import {
  encodeTestQuranRow,
  makeQuranChunk,
  makeQuranSurah,
} from "@repo/backend/test/quran/rows";
import { Effect, Schema } from "effect";

const JsonTextSchema = Schema.fromJsonString(Schema.Unknown);
const snapshotId = Sha256HashSchema.make(`sha256:${"b".repeat(64)}`);
const first = makeQuranChunk({
  firstQuranNumber: 1,
  firstVerse: 1,
  surahNumber: 1,
  verseCount: 2,
});
const second = makeQuranChunk({
  firstQuranNumber: 3,
  firstVerse: 3,
  surahNumber: 1,
  verseCount: 2,
});

it.effect("preserves contiguous chunk order and exact verse content", () =>
  Effect.gen(function* () {
    const verses = yield* decodeQuranChunkVerses(
      [first, second].map((chunk) => encodeTestQuranRow(snapshotId, chunk)),
      snapshotId,
      "reference",
      1
    );
    expect(verses).toEqual([...first.verses, ...second.verses]);
  })
);

it.effect.each([
  [],
  [
    makeQuranChunk({
      firstQuranNumber: 8,
      firstVerse: 1,
      surahNumber: 2,
      verseCount: 2,
    }),
  ],
  [
    first,
    makeQuranChunk({
      firstQuranNumber: 4,
      firstVerse: 4,
      surahNumber: 1,
      verseCount: 2,
    }),
  ],
  [
    first,
    makeQuranChunk({
      firstQuranNumber: 4,
      firstVerse: 3,
      surahNumber: 1,
      verseCount: 2,
    }),
  ],
  [second, first],
])("rejects empty, foreign, missing, and reordered Quran chunks", (chunks) =>
  Effect.gen(function* () {
    const failure = yield* decodeQuranChunkVerses(
      chunks.map((chunk) => encodeTestQuranRow(snapshotId, chunk)),
      snapshotId,
      "reference",
      1
    ).pipe(Effect.flip);
    expect(failure).toBeInstanceOf(QuranPublicationError);
    expect(failure.reason).toContain(
      "missing, out of order, or belong to another surah"
    );
  })
);

it.effect.each([
  "{",
  Schema.encodeSync(JsonTextSchema)({ family: "quran", record: {} }),
  encodeTestQuranRow(
    Sha256HashSchema.make(`sha256:${"c".repeat(64)}`),
    makeQuranSurah(1, 7)
  ),
  encodeTestQuranRow(snapshotId, makeQuranSurah(1, 7)),
])("rejects malformed, foreign, and wrong-kind search rows", (source) =>
  Effect.gen(function* () {
    const failure = yield* decodeQuranSearchRow(
      source,
      snapshotId,
      "reference"
    ).pipe(Effect.flip);
    expect(failure).toBeInstanceOf(QuranPublicationError);
    expect(failure.operation).toBe("reference");
  })
);
