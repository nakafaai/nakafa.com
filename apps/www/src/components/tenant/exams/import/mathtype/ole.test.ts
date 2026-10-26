import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect, Option } from "effect";
import { oleStream } from "@/components/tenant/exams/import/mathtype/ole";

/** The value a sector chain ends with, and the marks of a free sector and of a FAT sector. */
const END = 0xff_ff_ff_fe;
const FREE = 0xff_ff_ff_ff;
const FAT_SECTOR = 0xff_ff_ff_fd;

/** The size below which a compound file keeps a stream in its mini stream. */
const CUTOFF = 4096;

/** Bytes of a length, each its index modulo 251, so a misplaced sector shows. */
const bytesOf = (length: number, seed = 0) =>
  Uint8Array.from(Arr.makeBy(length, (index) => (index + seed) % 251));

/** The item of a list at an index, or a fallback past its end. */
const itemOr = (items: readonly number[], index: number, fallback: number) =>
  Option.getOrElse(Arr.get(items, index), () => fallback);

/** The FAT entries of a run of sectors: each names the next, and the last ends the chain. */
const chainOf = (start: number, count: number) =>
  Arr.map(Arr.range(1, count), (step) => (step === count ? END : start + step));

/** The first index of each run, when runs of these lengths follow one another from `first`. */
const startsOf = (counts: readonly number[], first: number) =>
  Arr.map(counts, (_count, index) =>
    Arr.reduce(Arr.take(counts, index), first, (sum, count) => sum + count)
  );

/**
 * A compound file of these named streams as Office writes one, with one sector each for the FAT, the directory and the
 * mini FAT, then the mini stream that holds the small streams, then each large stream in its own
 * run of sectors.
 */
const compound = (
  streams: readonly (readonly [string, Uint8Array])[],
  shift = 9
) => {
  const size = 2 ** shift;
  const small = Arr.filter(streams, ([, data]) => data.length < CUTOFF);
  const large = Arr.filter(streams, ([, data]) => data.length >= CUTOFF);
  const miniCounts = Arr.map(small, ([, data]) => Math.ceil(data.length / 64));
  const miniStarts = startsOf(miniCounts, 0);
  const container = Arr.reduce(miniCounts, 0, (sum, count) => sum + count) * 64;
  const containerSectors = Math.ceil(container / size);
  const largeCounts = Arr.map(large, ([, data]) =>
    Math.ceil(data.length / size)
  );
  const largeStarts = startsOf(largeCounts, 3 + containerSectors);
  const sectors =
    3 +
    containerSectors +
    Arr.reduce(largeCounts, 0, (sum, count) => sum + count);
  const file = new Uint8Array(size * (sectors + 1));
  const view = new DataView(file.buffer);
  const at = (sector: number) => (sector + 1) * size;
  const table = (sector: number, entries: readonly number[]) =>
    Arr.forEach(Arr.range(0, size / 4 - 1), (index) =>
      view.setUint32(at(sector) + index * 4, itemOr(entries, index, FREE), true)
    );
  const entry = (
    slot: number,
    name: string,
    type: number,
    start: number,
    length: number
  ) => {
    const offset = at(1) + slot * 128;
    Arr.forEach(Arr.fromIterable(name), (character, index) =>
      view.setUint16(offset + index * 2, character.charCodeAt(0), true)
    );
    view.setUint16(offset + 0x40, (name.length + 1) * 2, true);
    file[offset + 0x42] = type;
    view.setUint32(offset + 0x74, start, true);
    view.setUint32(offset + 0x78, length, true);
  };

  file.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  view.setUint16(0x1c, 0xff_fe, true);
  view.setUint16(0x1e, shift, true);
  view.setUint16(0x20, 6, true);
  view.setUint32(0x2c, 1, true);
  view.setUint32(0x30, 1, true);
  view.setUint32(0x38, CUTOFF, true);
  view.setUint32(0x3c, 2, true);
  view.setUint32(0x40, 1, true);
  view.setUint32(0x44, END, true);
  Arr.forEach(Arr.range(1, 108), (index) =>
    view.setUint32(0x4c + index * 4, FREE, true)
  );
  table(0, [
    FAT_SECTOR,
    END,
    END,
    ...(containerSectors > 0 ? chainOf(3, containerSectors) : []),
    ...Arr.flatMap(largeCounts, (count, index) =>
      chainOf(itemOr(largeStarts, index, 0), count)
    ),
  ]);
  table(
    2,
    Arr.flatMap(miniCounts, (count, index) =>
      chainOf(itemOr(miniStarts, index, 0), count)
    )
  );
  entry(0, "Root Entry", 5, containerSectors > 0 ? 3 : END, container);
  Arr.forEach(small, ([name, data], index) => {
    const start = itemOr(miniStarts, index, 0);
    entry(index + 1, name, 2, start, data.length);
    file.set(
      data,
      at(3 + Math.floor((start * 64) / size)) + ((start * 64) % size)
    );
  });
  Arr.forEach(large, ([name, data], index) => {
    const start = itemOr(largeStarts, index, 0);
    entry(small.length + index + 1, name, 2, start, data.length);
    file.set(data, at(start));
  });
  return file;
};

/** A copy of a file with one 32-bit integer replaced. */
const withWord = (file: Uint8Array, offset: number, value: number) => {
  const copy = Uint8Array.from(file);
  new DataView(copy.buffer).setUint32(offset, value, true);
  return copy;
};

/** A file with a small equation and a large picture, and the offsets its tests change. */
const FILE = compound([
  ["Equation Native", bytesOf(10)],
  ["Picture", bytesOf(4200)],
]);
const FAT = 512;
const DIRECTORY = 1024;
const PICTURE = DIRECTORY + 2 * 128;

/** The FAT entry of the picture's last sector, sector 12 of the file. */
const PICTURE_LAST = FAT + 12 * 4;

describe("oleStream", () => {
  it.effect(
    "reads a small stream from the mini stream and a large one from its own sectors",
    () =>
      Effect.gen(function* () {
        const equation = bytesOf(300, 7);
        const picture = bytesOf(5000, 3);
        const file = compound([
          ["CompObj", bytesOf(20)],
          ["Equation Native", equation],
          ["Picture", picture],
        ]);
        expect(yield* oleStream(file, "Equation Native")).toEqual(equation);
        expect(yield* oleStream(file, "Picture")).toEqual(picture);
      })
  );

  it.effect(
    "reads a file of 4096-byte sectors, and a chain that runs past its stream's size",
    () =>
      Effect.gen(function* () {
        const equation = bytesOf(100, 1);
        expect(
          yield* oleStream(
            compound([["Equation Native", equation]], 12),
            "Equation Native"
          )
        ).toEqual(equation);
        expect(
          yield* oleStream(withWord(FILE, PICTURE_LAST, 40), "Picture")
        ).toEqual(bytesOf(4200));
      })
  );

  it.effect(
    "refuses a file that is no compound file, has a header it cannot read, or holds no stream of the name",
    () =>
      Effect.gen(function* () {
        const refusals = yield* Effect.forEach(
          [
            oleStream(bytesOf(600), "Equation Native"),
            oleStream(FILE.subarray(0, 0x1f), "Equation Native"),
            // A sector shift of 8.
            oleStream(withWord(FILE, 0x1c, 0x00_08_ff_fe), "Equation Native"),
            // More FAT sectors than the header lists.
            oleStream(withWord(FILE, 0x2c, 110), "Equation Native"),
            oleStream(FILE, "Contents"),
          ],
          Effect.flip
        );
        expect(Arr.map(refusals, ({ reason }) => reason)).toEqual(
          Arr.makeBy(5, () => "ole")
        );
      })
  );

  it.effect(
    "refuses a file whose chains loop, run past its end, or name sectors and tables it lacks",
    () =>
      Effect.gen(function* () {
        const refusals = yield* Effect.forEach(
          [
            // The directory chain points back at itself.
            oleStream(withWord(FILE, FAT + 4, 1), "Picture"),
            // The directory lives in a sector past the end of the file.
            oleStream(withWord(FILE, 0x30, 40), "Picture"),
            // The directory chain names a FAT entry beyond the one FAT sector.
            oleStream(withWord(FILE, 0x30, 200), "Picture"),
            // The FAT sector itself lies past the end of the file.
            oleStream(withWord(FILE, 0x4c, 40), "Picture"),
            // The first entry is no root.
            oleStream(
              withWord(FILE, DIRECTORY + 0x40, 0x00_02_00_16),
              "Picture"
            ),
            // The picture claims more bytes than its chain holds.
            oleStream(withWord(FILE, PICTURE + 0x78, 9000), "Picture"),
            // The picture's chain continues into a sector past the end of the file.
            oleStream(
              withWord(withWord(FILE, PICTURE_LAST, 40), PICTURE + 0x78, 4700),
              "Picture"
            ),
            // The equation's mini chain names a mini table sector the file does not have.
            oleStream(
              withWord(FILE, DIRECTORY + 128 + 0x74, 200),
              "Equation Native"
            ),
            // The root names no mini stream.
            oleStream(withWord(FILE, DIRECTORY + 0x74, END), "Equation Native"),
            // The file ends inside the directory.
            oleStream(FILE.subarray(0, DIRECTORY + 64), "Picture"),
          ],
          Effect.flip
        );
        expect(Arr.map(refusals, ({ reason }) => reason)).toEqual(
          Arr.makeBy(10, () => "ole")
        );
      })
  );
});
