import type { HullLines } from "@repo/design-system/components/three/vessel/hull";
import { stationAt } from "@repo/design-system/components/three/vessel/hull";
import { Array as Arr } from "effect";

/**
 * The half-breadth of a hull's inside at a height above its keel, at `x`
 * along it from the transom at -length/2 to the stem at +length/2: how wide
 * a floorboard, a thwart or a bulkhead fitted there is cut. Below the keel's
 * own height at that station there is no hull, so the breadth is zero.
 *
 * @param lines - The hull's lines
 * @param x - The place along the hull
 * @param height - The height above the keel amidships
 */
export function breadthAt(lines: HullLines, x: number, height: number) {
  const station = stationAt(lines, x / lines.length + 0.5);
  const down = (station.deck - height) / (station.deck - station.keel);
  if (down >= 1) {
    return 0;
  }
  const power = 2 / station.square;
  const cosine = Math.max(0, down) ** (1 / power);
  return station.half * Math.sqrt(1 - cosine * cosine) ** power;
}

/**
 * A flat sheet that closes a hull's inside at a height above its keel, from
 * the transom to the stem, as wide at every station as the hull is there.
 * Drawn into depth alone it keeps the water outside the hull from showing
 * through the open boat: the sea is one surface, and it has no hole where a
 * hull floats in it.
 *
 * @param lines - The lines of the hull's inside
 * @param height - The height above the keel amidships
 * @param stations - How many strips the sheet is cut into along the hull
 */
export function lidSheet(lines: HullLines, height: number, stations: number) {
  const positions = Arr.flatMap(Arr.range(0, stations), (station) => {
    const x = (station / stations - 0.5) * lines.length;
    const half = breadthAt(lines, x, height);
    return [x, height, half, x, height, -half];
  });
  const indices = Arr.flatMap(Arr.range(0, stations - 1), (station) => {
    const first = station * 2;
    return [first, first + 2, first + 1, first + 1, first + 2, first + 3];
  });
  return { indices, positions };
}
