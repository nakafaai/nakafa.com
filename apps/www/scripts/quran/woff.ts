import { brotliCompressSync, brotliDecompressSync, constants } from "node:zlib";
import { Array as Arr, Effect, Option, Schema } from "effect";

/**
 * A WOFF2 file this module cannot read or write: a wrong signature, a cut
 * header, directory or stream, a font collection, an extended metadata or
 * private block, or a font without the tables a line box reads.
 */
export class WoffMalformed extends Schema.TaggedError<
  WoffMalformed,
  { readonly brand: unique symbol }
>()("WoffMalformed", {
  message: Schema.String,
}) {}

/**
 * The vertical metrics a line box reads from a face, in font units: how far its
 * box rises above the baseline, how far it falls below (negative), and the gap
 * between two lines.
 */
export const VerticalMetricsSchema = Schema.Struct({
  ascent: Schema.Int,
  descent: Schema.Int,
  lineGap: Schema.Int,
});

/** The header of a WOFF2 file, before its table directory. */
const HEADER_SIZE = 48;
/** `wOF2`, the signature a WOFF2 file starts with. */
const SIGNATURE = 0x77_4f_46_32;
/** `ttcf`, the flavor of a font collection, whose extra directory this module does not read. */
const COLLECTION = 0x74_74_63_66;

/** The fields of the header this module reads or writes, by their offset. */
const FLAVOR_AT = 4;
const LENGTH_AT = 8;
const TABLE_COUNT_AT = 12;
const COMPRESSED_AT = 20;
const META_AT = 28;
const PRIVATE_AT = 40;

/**
 * The index of a table among the WOFF2 known tags, the low six bits of its flags
 * byte, and the index of an arbitrary tag. The two high bits name its transform.
 */
const HHEA = 2;
const OS2 = 6;
const GLYF = 10;
const LOCA = 11;
const ARBITRARY = 63;

/** Where the three vertical metrics stand inside `hhea` and inside OS/2. */
const HHEA_METRICS_AT = 4;
const TYPO_METRICS_AT = 68;
/** The bytes of three signed 16-bit metrics. */
const METRICS_SIZE = 6;

/** A UIntBase128 holds at most five bytes. */
const BASE128_BYTES = 5;

/** One table of the directory: its known-tag index and where its data lies in the stream. */
const TableSchema = Schema.Struct({
  index: Schema.Int,
  length: Schema.Int,
  offset: Schema.Int,
});

type Table = typeof TableSchema.Type;
type VerticalMetrics = typeof VerticalMetricsSchema.Type;

/** A refusal that names what this module could not read. */
const refused = (message: string) => new WoffMalformed({ message });

/** The view of the bytes that reads big-endian integers, as a font stores them. */
const viewOf = (bytes: Uint8Array) =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

/** The byte at an offset of the directory, or a refusal past the end of the file. */
const byteAt = (bytes: Uint8Array, offset: number) =>
  offset >= bytes.length
    ? Effect.fail(refused("the table directory is cut"))
    : Effect.succeed(viewOf(bytes).getUint8(offset));

/**
 * Reads one UIntBase128 at an offset of the directory: seven bits a byte, a
 * byte of 128 or more marking that another byte follows. A leading zero byte, a value past
 * 32 bits, a sixth byte or the end of the file is refused.
 */
const readBase128 = (bytes: Uint8Array, start: number) =>
  Effect.gen(function* () {
    let value = 0;
    for (let index = 0; index < BASE128_BYTES; index += 1) {
      const byte = yield* byteAt(bytes, start + index);
      if (index === 0 && byte === 0x80) {
        return yield* refused("a table length starts with a zero byte");
      }
      if (value > 0x01_ff_ff_ff) {
        return yield* refused("a table length passes 32 bits");
      }
      value = value * 128 + (byte % 128);
      if (byte < 128) {
        return { next: start + index + 1, value };
      }
    }
    return yield* refused("a table length runs past five bytes");
  });

/**
 * Reads the table directory: each table's known-tag index and its length in the
 * decompressed stream, where the tables follow each other in directory order.
 * `glyf` and `loca` are transformed unless they carry the null transform 3, and
 * every other table is transformed unless it carries 0; a transformed table
 * keeps its transformed length in the stream.
 */
const readDirectory = (bytes: Uint8Array, count: number) =>
  Effect.gen(function* () {
    let at = HEADER_SIZE;
    let offset = 0;
    let tables: readonly Table[] = [];
    for (let entry = 0; entry < count; entry += 1) {
      const flags = yield* byteAt(bytes, at);
      const index = flags % 64;
      const version = Math.floor(flags / 64);
      at += index === ARBITRARY ? 5 : 1;
      const original = yield* readBase128(bytes, at);
      const transformed =
        index === GLYF || index === LOCA ? version === 0 : version !== 0;
      const stored = transformed
        ? yield* readBase128(bytes, original.next)
        : original;
      at = stored.next;
      tables = Arr.append(tables, { index, length: stored.value, offset });
      offset += stored.value;
    }
    return { end: at, size: offset, tables };
  });

/**
 * The parts of a WOFF2 file: its header and directory bytes, the decompressed
 * stream of its tables, and where `hhea` and OS/2 lie in that stream. A file
 * with a metadata or private block, or a collection, is refused, since no face
 * this app serves has one.
 */
const readParts = (font: Uint8Array) =>
  Effect.gen(function* () {
    if (font.length < HEADER_SIZE) {
      return yield* refused("the header is cut");
    }
    const view = viewOf(font);
    if (view.getUint32(0) !== SIGNATURE) {
      return yield* refused("the file is not WOFF2");
    }
    if (view.getUint32(FLAVOR_AT) === COLLECTION) {
      return yield* refused("the file is a font collection");
    }
    if (view.getUint32(META_AT) !== 0 || view.getUint32(PRIVATE_AT) !== 0) {
      return yield* refused("the file has a metadata or private block");
    }
    const directory = yield* readDirectory(
      font,
      view.getUint16(TABLE_COUNT_AT)
    );
    const compressedEnd = directory.end + view.getUint32(COMPRESSED_AT);
    if (compressedEnd > font.length) {
      return yield* refused("the font stream is cut");
    }
    const stream = yield* Effect.try({
      catch: () => refused("the font stream is not Brotli"),
      try: () =>
        new Uint8Array(
          brotliDecompressSync(font.subarray(directory.end, compressedEnd))
        ),
    });
    if (stream.length !== directory.size) {
      return yield* refused("the font stream does not hold its tables");
    }
    const tableOf = (index: number, size: number, name: string) =>
      Arr.findFirst(directory.tables, (table) => table.index === index).pipe(
        Option.filter((table) => table.length >= size),
        Effect.fromOption,
        Effect.mapError(() => refused(`the font has no whole ${name} table`))
      );
    const hhea = yield* tableOf(HHEA, HHEA_METRICS_AT + METRICS_SIZE, "hhea");
    const os2 = yield* tableOf(OS2, TYPO_METRICS_AT + METRICS_SIZE, "OS/2");
    return {
      head: font.subarray(0, directory.end),
      hhea: hhea.offset + HHEA_METRICS_AT,
      stream,
      typo: os2.offset + TYPO_METRICS_AT,
    };
  });

/** Reads the three metrics stored at an offset of the stream. */
const metricsAt = (stream: Uint8Array, at: number): VerticalMetrics => {
  const view = viewOf(stream);
  return {
    ascent: view.getInt16(at),
    descent: view.getInt16(at + 2),
    lineGap: view.getInt16(at + 4),
  };
};

/** Writes the three metrics at an offset of the stream. */
const writeMetricsAt = (
  stream: Uint8Array,
  at: number,
  metrics: VerticalMetrics
) => {
  const view = viewOf(stream);
  view.setInt16(at, metrics.ascent);
  view.setInt16(at + 2, metrics.descent);
  view.setInt16(at + 4, metrics.lineGap);
};

/**
 * The vertical metrics a WOFF2 face gives a line box: `hhea`, which Apple's
 * platforms and most engines read, and the OS/2 typographic fields, which an
 * engine reads wherever the face sets USE_TYPO_METRICS, as Amiri Quran does.
 */
export const readFaceMetrics = Effect.fn("scripts.quran.woff.readFaceMetrics")(
  function* (font: Uint8Array) {
    const parts = yield* readParts(font);
    return {
      hhea: metricsAt(parts.stream, parts.hhea),
      typo: metricsAt(parts.stream, parts.typo),
    };
  }
);

/**
 * The same WOFF2 face with these vertical metrics in `hhea` and in OS/2, and
 * every other byte of its tables unchanged. The stream is compressed again in
 * Brotli's font mode, and the file ends on a four-byte boundary, as a decoder
 * expects. A decoder rebuilds each table's checksum, so none is stored.
 */
export const writeFaceMetrics = Effect.fn(
  "scripts.quran.woff.writeFaceMetrics"
)(function* (font: Uint8Array, metrics: VerticalMetrics) {
  const parts = yield* readParts(font);
  const stream = Uint8Array.from(parts.stream);
  writeMetricsAt(stream, parts.hhea, metrics);
  writeMetricsAt(stream, parts.typo, metrics);
  const compressed = brotliCompressSync(stream, {
    params: {
      [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_FONT,
      [constants.BROTLI_PARAM_QUALITY]: constants.BROTLI_MAX_QUALITY,
      [constants.BROTLI_PARAM_SIZE_HINT]: stream.length,
    },
  });
  const end = parts.head.length + compressed.length;
  const file = new Uint8Array(Math.ceil(end / 4) * 4);
  file.set(parts.head, 0);
  file.set(compressed, parts.head.length);
  const view = viewOf(file);
  view.setUint32(LENGTH_AT, file.length);
  view.setUint32(COMPRESSED_AT, compressed.length);
  return file;
});
