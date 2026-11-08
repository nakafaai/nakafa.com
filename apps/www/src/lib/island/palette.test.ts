import { describe, expect, it } from "@effect/vitest";
import { Array as Arr, Order, Record } from "effect";
import {
  PALETTE_SIZE,
  paletteBytes,
  paletteIndex,
  RAMPS,
} from "@/lib/island/palette";

describe("island palette", () => {
  it("gives every ramp its own row, with no row left empty", () => {
    const rows = Arr.sort(
      Arr.map(Record.values(RAMPS), (ramp) => ramp.row),
      Order.Number
    );
    expect(rows).toEqual(Arr.range(0, Record.size(RAMPS) - 1));
    expect(PALETTE_SIZE).toBe(Record.size(RAMPS) * 4);
  });

  it("lays each tone's colour at its palette index, opaque", () => {
    const bytes = paletteBytes();
    expect(bytes).toHaveLength(PALETTE_SIZE * 4);
    const red = paletteIndex("roof", 2) * 4;
    expect(Arr.fromIterable(bytes.subarray(red, red + 4))).toEqual([
      0xdc, 0x34, 0x37, 255,
    ]);
    const nina = paletteIndex("nina", 3) * 4;
    expect(Arr.fromIterable(bytes.subarray(nina, nina + 3))).toEqual([
      0xe3, 0xf6, 0xfe,
    ]);
  });
});
