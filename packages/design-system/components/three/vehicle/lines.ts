import type { HullLines } from "@repo/design-system/components/three/vessel/hull";
import { stationAt } from "@repo/design-system/components/three/vessel/hull";

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
