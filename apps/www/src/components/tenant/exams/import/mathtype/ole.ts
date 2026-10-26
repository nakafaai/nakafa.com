import { Array as Arr, Effect, Option } from "effect";
import { MathTypeUnread } from "@/components/tenant/exams/import/mathtype/errors";

/** The bytes a compound file starts with. */
const SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

/** The least sector number that ends a chain (end, free or reserved) instead of naming a sector. */
const LAST_SECTOR = 0xff_ff_ff_fa;

/** The size of one directory entry, and of one sector of the mini stream. */
const ENTRY_SIZE = 128;
const MINI_SIZE = 64;

/** The most FAT sectors the header lists by itself; a larger file is no equation object. */
const HEADER_FAT_SECTORS = 109;

/** The directory entry types the reader looks at: a stream, and the root that holds the mini stream. */
const STREAM = 2;
const ROOT = 5;

/** The refusal of a file that is no compound file, or holds no stream of the name. */
const refused = () => new MathTypeUnread({ reason: "ole" });

/** The view of the bytes that reads little-endian integers. */
const viewOf = (bytes: Uint8Array) =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

/** The 16-bit integer at an offset of the file, or a refusal past its end. */
const u16At = (bytes: Uint8Array, offset: number) =>
  offset + 2 > bytes.length
    ? Effect.fail(refused())
    : Effect.succeed(viewOf(bytes).getUint16(offset, true));

/** The 32-bit integer at an offset of the file, or a refusal past its end. */
const u32At = (bytes: Uint8Array, offset: number) =>
  offset + 4 > bytes.length
    ? Effect.fail(refused())
    : Effect.succeed(viewOf(bytes).getUint32(offset, true));

/** The item of a list at an index, or a refusal when the file names one it does not have. */
const itemAt = (items: readonly number[], index: number) =>
  Effect.fromOption(Arr.get(items, index)).pipe(Effect.mapError(refused));

/**
 * The sectors of a chain from its first sector, each next one named by `next`. A chain longer
 * than the file has sectors loops, and is refused.
 */
const chainOf = (
  start: number,
  next: (sector: number) => Effect.Effect<number, MathTypeUnread>,
  limit: number
) =>
  Effect.gen(function* () {
    let sectors: readonly number[] = [];
    let sector = start;
    while (sector < LAST_SECTOR) {
      if (sectors.length >= limit) {
        return yield* refused();
      }
      sectors = Arr.append(sectors, sector);
      sector = yield* next(sector);
    }
    return sectors;
  });

/**
 * The first `size` bytes of a stream whose pieces of `piece` bytes start at these offsets of the
 * file. A stream whose pieces hold fewer bytes, or run past the file, is refused.
 */
const gather = (
  bytes: Uint8Array,
  offsets: readonly number[],
  piece: number,
  size: number
) =>
  Effect.gen(function* () {
    if (offsets.length * piece < size) {
      return yield* refused();
    }
    const stream = new Uint8Array(size);
    yield* Effect.forEach(offsets, (offset, index) => {
      const count = Math.min(piece, size - index * piece);
      if (count <= 0) {
        return Effect.void;
      }
      if (offset + count > bytes.length) {
        return Effect.fail(refused());
      }
      stream.set(bytes.subarray(offset, offset + count), index * piece);
      return Effect.void;
    });
    return stream;
  });

/** The name, type, first sector and size of the directory entry at an offset of the file. */
const entryAt = (bytes: Uint8Array, offset: number) =>
  Effect.gen(function* () {
    if (offset + ENTRY_SIZE > bytes.length) {
      return yield* refused();
    }
    const length = yield* u16At(bytes, offset + 0x40);
    return {
      name: new TextDecoder("utf-16le").decode(
        bytes.subarray(offset, offset + Math.max(Math.min(length, 64) - 2, 0))
      ),
      size: yield* u32At(bytes, offset + 0x78),
      start: yield* u32At(bytes, offset + 0x74),
      type: bytes[offset + 0x42],
    };
  });

/**
 * Reads one stream of a compound file (an OLE object, as Word embeds a MathType equation): the
 * header names the sector size, the file allocation table chains the sectors of the directory and
 * of each stream, and a stream below the cutoff lives in the root's mini stream, chained by the
 * mini allocation table. A file that is no compound file, that chains past its own end, or that
 * holds no stream of the name is refused.
 */
export const oleStream = Effect.fn("exams.import.mathtype.ole")(function* (
  bytes: Uint8Array,
  name: string
) {
  if (!Arr.every(SIGNATURE, (byte, index) => bytes[index] === byte)) {
    return yield* refused();
  }
  const sectorShift = yield* u16At(bytes, 0x1e);
  const miniShift = yield* u16At(bytes, 0x20);
  const fatSectors = yield* u32At(bytes, 0x2c);
  if (
    !(sectorShift === 9 || sectorShift === 12) ||
    2 ** miniShift !== MINI_SIZE ||
    fatSectors > HEADER_FAT_SECTORS
  ) {
    return yield* refused();
  }
  const sectorSize = 2 ** sectorShift;
  const perSector = sectorSize / 4;
  const limit = Math.ceil(bytes.length / MINI_SIZE);
  const sectorOffset = (sector: number) => (sector + 1) * sectorSize;
  const fatEntry = (index: number) =>
    Effect.gen(function* () {
      const table = Math.floor(index / perSector);
      if (table >= fatSectors) {
        return yield* refused();
      }
      const sector = yield* u32At(bytes, 0x4c + table * 4);
      return yield* u32At(
        bytes,
        sectorOffset(sector) + (index % perSector) * 4
      );
    });

  const directory = yield* chainOf(yield* u32At(bytes, 0x30), fatEntry, limit);
  const entries = yield* Effect.forEach(
    Arr.flatMap(directory, (sector) =>
      Arr.map(
        Arr.range(0, sectorSize / ENTRY_SIZE - 1),
        (slot) => sectorOffset(sector) + slot * ENTRY_SIZE
      )
    ),
    (offset) => entryAt(bytes, offset)
  );
  const root = yield* Effect.fromOption(
    Option.filter(Arr.head(entries), (entry) => entry.type === ROOT)
  ).pipe(Effect.mapError(refused));
  const entry = yield* Effect.fromOption(
    Arr.findFirst(
      entries,
      (candidate) => candidate.type === STREAM && candidate.name === name
    )
  ).pipe(Effect.mapError(refused));

  if (entry.size >= (yield* u32At(bytes, 0x38))) {
    const sectors = yield* chainOf(entry.start, fatEntry, limit);
    return yield* gather(
      bytes,
      Arr.map(sectors, sectorOffset),
      sectorSize,
      entry.size
    );
  }
  const miniTable = yield* chainOf(yield* u32At(bytes, 0x3c), fatEntry, limit);
  const container = yield* chainOf(root.start, fatEntry, limit);
  const miniEntry = (index: number) =>
    Effect.gen(function* () {
      const sector = yield* itemAt(miniTable, Math.floor(index / perSector));
      return yield* u32At(
        bytes,
        sectorOffset(sector) + (index % perSector) * 4
      );
    });
  const minis = yield* chainOf(entry.start, miniEntry, limit);
  const offsets = yield* Effect.forEach(minis, (mini) =>
    Effect.map(
      itemAt(container, Math.floor((mini * MINI_SIZE) / sectorSize)),
      (sector) => sectorOffset(sector) + ((mini * MINI_SIZE) % sectorSize)
    )
  );
  return yield* gather(bytes, offsets, MINI_SIZE, entry.size);
});
