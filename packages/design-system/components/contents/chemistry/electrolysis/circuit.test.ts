import { describe, expect, it } from "@effect/vitest";
import {
  BATTERY_Y,
  cellCentres,
  circuitLeads,
  ELECTRODE_TOP,
  pointAlong,
  TERMINAL_OFFSET,
} from "@repo/design-system/components/contents/chemistry/electrolysis/circuit";
import { Array as Arr, Option } from "effect";

describe("electrolysis circuit", () => {
  it("centres one cell under the battery and spreads two either side", () => {
    expect(cellCentres(1)).toEqual([0]);
    expect(cellCentres(2)).toEqual([-0.8, 0.8]);
  });

  it("runs one cell's leads from its anode to the positive terminal and from the negative terminal to its cathode", () => {
    expect(circuitLeads(1)).toEqual([
      [
        [-0.2, ELECTRODE_TOP, 0],
        [-0.2, BATTERY_Y, 0],
        [-TERMINAL_OFFSET, BATTERY_Y, 0],
      ],
      [
        [TERMINAL_OFFSET, BATTERY_Y, 0],
        [0.2, BATTERY_Y, 0],
        [0.2, ELECTRODE_TOP, 0],
      ],
    ]);
  });

  it("links the second cell's anode to the first cell's cathode in series", () => {
    const leads = circuitLeads(2);

    expect(leads).toHaveLength(3);
    expect(leads[1]?.[0]).toEqual([0.600_000_000_000_000_1, ELECTRODE_TOP, 0]);
    expect(Arr.last(leads[1] ?? [])).toEqual(
      Option.some([-0.600_000_000_000_000_1, ELECTRODE_TOP, 0])
    );
  });

  it("moves along a path by length, around its corners, and wraps", () => {
    const path = [
      [0, 0, 0],
      [0, 1, 0],
      [0, 1, 0],
      [3, 1, 0],
    ] as const;

    expect(pointAlong(path, 0)).toEqual([0, 0, 0]);
    expect(pointAlong(path, 0.125)).toEqual([0, 0.5, 0]);
    expect(pointAlong(path, 0.5)).toEqual([1, 1, 0]);
    expect(pointAlong(path, 1.5)).toEqual([1, 1, 0]);
    expect(pointAlong(path, -0.5)).toEqual([1, 1, 0]);
  });

  it("keeps a path of one point in place", () => {
    expect(pointAlong([[1, 2, 3]], 0.4)).toEqual([1, 2, 3]);
  });
});
