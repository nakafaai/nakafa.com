// @vitest-environment node

import { brotliCompressSync, brotliDecompressSync } from "node:zlib";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, FileSystem, Path, Schema } from "effect";
import { readFaceMetrics } from "@/scripts/quran/test.woff";
import { writeFaceMetrics } from "@/scripts/quran/woff";

const PUBLISHED = { ascent: 1815, descent: -634, lineGap: 0 };
const BALANCED = { ascent: 848, descent: -451, lineGap: 0 };

/** One table of a synthetic font: its directory bytes after the flags, and its data in the stream. */
const table = (
  flags: number,
  data: Uint8Array,
  lengths: readonly number[]
) => ({
  directory: Uint8Array.from([flags, ...Arr.flatMap(lengths, base128)]),
  data,
});

/** A UIntBase128 of a small length, as a directory stores it. */
function base128(value: number): number[] {
  return value < 128 ? [value] : [128 + Math.floor(value / 128), value % 128];
}

/** A table of `size` bytes, each its own offset, so a moved byte shows. */
const filled = (size: number) =>
  Uint8Array.from(Arr.makeBy(size, (at) => at % 251));

/** `hhea` with the published metrics at their offset. */
const hhea = () => {
  const data = filled(36);
  const view = new DataView(data.buffer);
  view.setInt16(4, PUBLISHED.ascent);
  view.setInt16(6, PUBLISHED.descent);
  view.setInt16(8, PUBLISHED.lineGap);
  return data;
};

/** OS/2 with the published typographic metrics at their offset. */
const os2 = () => {
  const data = filled(96);
  const view = new DataView(data.buffer);
  view.setInt16(68, PUBLISHED.ascent);
  view.setInt16(70, PUBLISHED.descent);
  view.setInt16(72, PUBLISHED.lineGap);
  return data;
};

/**
 * Every kind of directory entry: an arbitrary tag, a transformed `glyf`, a
 * `loca` under the null transform, a transformed `hmtx`, and `hhea` and OS/2,
 * which keep their data as it is.
 */
const TABLES = [
  {
    directory: Uint8Array.from([63, 0x47, 0x44, 0x45, 0x46, 10]),
    data: filled(10),
  },
  table(10, filled(200), [300, 200]),
  table(3 * 64 + 11, filled(8), [8]),
  table(1 * 64 + 3, filled(12), [40, 12]),
  table(2, hhea(), [36]),
  table(6, os2(), [96]),
];

/** One table of a synthetic font: its directory entry, and its data in the stream. */
const TableSchema = Schema.Struct({
  data: Schema.Uint8Array,
  directory: Schema.Uint8Array,
});

/** The header fields and the stream a test may set apart from a well-formed file. */
const FieldsSchema = Schema.Struct({
  compressed: Schema.optionalKey(Schema.Uint8Array),
  flavor: Schema.optionalKey(Schema.Int),
  meta: Schema.optionalKey(Schema.Int),
  priv: Schema.optionalKey(Schema.Int),
  signature: Schema.optionalKey(Schema.Int),
});

/** A WOFF2 file around these tables, with header fields a test may set apart. */
function woff(
  tables: readonly (typeof TableSchema.Type)[],
  fields: typeof FieldsSchema.Type = {}
) {
  const directory = Uint8Array.from(
    Arr.flatMap(tables, (entry) => Arr.fromIterable(entry.directory))
  );
  const stream = Uint8Array.from(
    Arr.flatMap(tables, (entry) => Arr.fromIterable(entry.data))
  );
  const compressed = fields.compressed ?? brotliCompressSync(stream);
  const file = new Uint8Array(48 + directory.length + compressed.length);
  const view = new DataView(file.buffer);
  view.setUint32(0, fields.signature ?? 0x77_4f_46_32);
  view.setUint32(4, fields.flavor ?? 0x00_01_00_00);
  view.setUint32(8, file.length);
  view.setUint16(12, tables.length);
  view.setUint32(20, compressed.length);
  view.setUint32(28, fields.meta ?? 0);
  view.setUint32(40, fields.priv ?? 0);
  file.set(directory, 48);
  file.set(compressed, 48 + directory.length);
  return file;
}

/** The decompressed stream of a written synthetic font, whose directory length the test knows. */
const streamOf = (file: Uint8Array, directory: number) => {
  const compressed = new DataView(file.buffer).getUint32(20);
  return new Uint8Array(
    brotliDecompressSync(
      file.subarray(48 + directory, 48 + directory + compressed)
    )
  );
};

/** The message a refused file carries. */
const refusal = (font: Uint8Array) =>
  readFaceMetrics(font).pipe(
    Effect.flip,
    Effect.map((error) => error.message)
  );

describe("readFaceMetrics", () => {
  it.effect("reads the published metrics of Amiri Quran's Arabic subset", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const file = yield* path.fromFileUrl(
        new URL(
          import.meta.resolve(
            "@fontsource/amiri-quran/files/amiri-quran-arabic-400-normal.woff2"
          )
        )
      );
      const font = yield* fs.readFile(file);

      expect(yield* readFaceMetrics(font)).toEqual({
        hhea: PUBLISHED,
        typo: PUBLISHED,
      });

      const written = yield* writeFaceMetrics(font, BALANCED);
      expect(yield* readFaceMetrics(written)).toEqual({
        hhea: BALANCED,
        typo: BALANCED,
      });
      expect(written.length % 4).toBe(0);
    }).pipe(Effect.provide(NodeServices.layer))
  );

  it.effect("finds hhea and OS/2 behind every kind of directory entry", () =>
    Effect.gen(function* () {
      expect(yield* readFaceMetrics(woff(TABLES))).toEqual({
        hhea: PUBLISHED,
        typo: PUBLISHED,
      });
    })
  );

  it.effect("refuses a file it cannot read, naming why", () =>
    Effect.gen(function* () {
      const font = woff(TABLES);
      expect(yield* refusal(font.subarray(0, 40))).toBe("the header is cut");
      expect(yield* refusal(woff(TABLES, { signature: 0x77_4f_46_46 }))).toBe(
        "the file is not WOFF2"
      );
      expect(yield* refusal(woff(TABLES, { flavor: 0x74_74_63_66 }))).toBe(
        "the file is a font collection"
      );
      expect(yield* refusal(woff(TABLES, { meta: 64 }))).toBe(
        "the file has a metadata or private block"
      );
      expect(yield* refusal(woff(TABLES, { priv: 64 }))).toBe(
        "the file has a metadata or private block"
      );
      expect(yield* refusal(font.subarray(0, 48))).toBe(
        "the table directory is cut"
      );
      expect(yield* refusal(font.subarray(0, 50))).toBe(
        "the table directory is cut"
      );
      expect(
        yield* refusal(
          woff([{ directory: Uint8Array.from([2, 0x80, 1]), data: hhea() }])
        )
      ).toBe("a table length starts with a zero byte");
      expect(
        yield* refusal(
          woff([
            {
              directory: Uint8Array.from([2, 0x90, 0x80, 0x80, 0x80, 1]),
              data: hhea(),
            },
          ])
        )
      ).toBe("a table length passes 32 bits");
      expect(
        yield* refusal(
          woff([
            {
              directory: Uint8Array.from([2, 0x81, 0x80, 0x80, 0x80, 0x80, 1]),
              data: hhea(),
            },
          ])
        )
      ).toBe("a table length runs past five bytes");
    })
  );

  it.effect("refuses a stream that is cut, not Brotli, or not its tables", () =>
    Effect.gen(function* () {
      const font = woff(TABLES);
      expect(yield* refusal(font.subarray(0, font.length - 1))).toBe(
        "the font stream is cut"
      );
      expect(
        yield* refusal(
          woff(TABLES, { compressed: Uint8Array.from([1, 2, 3, 4]) })
        )
      ).toBe("the font stream is not Brotli");
      expect(
        yield* refusal(
          woff(TABLES, { compressed: brotliCompressSync(filled(3)) })
        )
      ).toBe("the font stream does not hold its tables");
    })
  );

  it.effect("refuses a font without whole hhea and OS/2 tables", () =>
    Effect.gen(function* () {
      expect(yield* refusal(woff([table(6, os2(), [96])]))).toBe(
        "the font has no whole hhea table"
      );
      expect(
        yield* refusal(woff([table(2, filled(8), [8]), table(6, os2(), [96])]))
      ).toBe("the font has no whole hhea table");
      expect(yield* refusal(woff([table(2, hhea(), [36])]))).toBe(
        "the font has no whole OS/2 table"
      );
    })
  );
});

describe("writeFaceMetrics", () => {
  it.effect("changes the metrics in hhea and OS/2 and no other byte", () =>
    Effect.gen(function* () {
      const directory = Arr.reduce(
        TABLES,
        0,
        (size, entry) => size + entry.directory.length
      );
      const before = streamOf(woff(TABLES), directory);
      const written = yield* writeFaceMetrics(woff(TABLES), BALANCED);
      const after = streamOf(written, directory);

      expect(yield* readFaceMetrics(written)).toEqual({
        hhea: BALANCED,
        typo: BALANCED,
      });
      const changed = Arr.filter(
        Arr.makeBy(before.length, (at) => at),
        (at) => before[at] !== after[at]
      );
      const hheaAt = 10 + 200 + 8 + 12;
      const typoAt = hheaAt + 36 + 68;
      expect(
        Arr.every(
          changed,
          (at) =>
            (at >= hheaAt + 4 && at < hheaAt + 10) ||
            (at >= typoAt && at < typoAt + 6)
        )
      ).toBe(true);
      expect(new DataView(written.buffer).getUint32(8)).toBe(written.length);
      expect(written.length % 4).toBe(0);
    })
  );

  it.effect("refuses a file it cannot read", () =>
    Effect.gen(function* () {
      const error = yield* writeFaceMetrics(new Uint8Array(4), BALANCED).pipe(
        Effect.flip
      );
      expect(error._tag).toBe("WoffMalformed");
    })
  );
});
