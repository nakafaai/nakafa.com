import { describe, expect, it } from "@effect/vitest";
import {
  bareChunk,
  Chunk,
  chunkKeyOf,
  isBare,
  regionOf,
} from "@repo/backend/confect/island/chunk";
import { Schema } from "effect";

/** A buffer of this many bytes whose byte at `index` is 1. */
function marked(bytes: number, index: number) {
  const buffer = new ArrayBuffer(bytes);
  new DataView(buffer).setUint8(index, 1);
  return buffer;
}

describe("island/chunk", () => {
  it("keeps the packed points as bytes both ways and refuses a buffer of another length", () => {
    const chunk = bareChunk();
    const encoded = Schema.encodeSync(Chunk)(chunk);
    expect(encoded.lifts).toBe(chunk.lifts);
    expect(Schema.decodeSync(Chunk)(encoded)).toEqual(chunk);
    const refused = (part: string, bytes: number) =>
      Schema.decodeOption(Chunk)({
        ...chunk,
        [part]: new ArrayBuffer(bytes),
      })._tag;
    expect(refused("lifts", 1023)).toBe("None");
    expect(refused("paints", 1025)).toBe("None");
    expect(refused("clears", 1024)).toBe("None");
    expect(refused("clears", 128)).toBe("Some");
  });

  it("finds the region of a chunk on both sides of the origin", () => {
    expect(regionOf(0)).toBe(0);
    expect(regionOf(7)).toBe(0);
    expect(regionOf(8)).toBe(1);
    expect(regionOf(-1)).toBe(-1);
    expect(regionOf(-8)).toBe(-1);
    expect(regionOf(-9)).toBe(-2);
    expect(regionOf(4095)).toBe(511);
    expect(regionOf(-4096)).toBe(-512);
  });

  it("gives each chunk one key", () => {
    expect(chunkKeyOf(-4096, -4096)).toBe(0);
    expect(chunkKeyOf(0, 1)).not.toBe(chunkKeyOf(1, 0));
    expect(chunkKeyOf(-1, 4095)).not.toBe(chunkKeyOf(0, -4096));
  });

  it("calls a chunk bare only when no point and no thing is changed", () => {
    const bare = bareChunk();
    expect(isBare(bare)).toBe(true);
    expect(isBare({ ...bare, lifts: marked(1024, 1023) })).toBe(false);
    expect(isBare({ ...bare, paints: marked(1024, 0) })).toBe(false);
    expect(isBare({ ...bare, clears: marked(128, 127) })).toBe(false);
    expect(
      isBare({ ...bare, things: [{ at: 0, kind: "bush", turn: 0 }] })
    ).toBe(false);
  });
});
