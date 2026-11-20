import type { Point } from "@repo/design-system/components/contents/biology/capillary/bed";
import {
  ARTERIOLE_PATH,
  arterioleRadius,
  BLOCK,
  CAPILLARIES,
  CAPILLARY,
  curve,
  LYMPH,
  LYMPH_PATH,
  MICRONS,
  outer,
  VENULE_PATH,
  venuleRadius,
} from "@repo/design-system/components/contents/biology/capillary/bed";
import { hashUnit } from "@repo/design-system/components/contents/simulation/grain";
import { Array as Arr, Schema } from "effect";

/**
 * Where the tissue cells of the capillary bed lie: packed into the gaps
 * between the vessels, on the bed's footprint, in scene units.
 */

/** A disc of the bed's footprint, in scene units: what a cell or a stretch of vessel covers. */
const DiscSchema = Schema.Struct({
  radius: Schema.Finite,
  x: Schema.Finite,
  z: Schema.Finite,
});
type Disc = typeof DiscSchema.Type;

/** How many stretches each vessel is checked in when cells are placed. */
const STRETCHES = 80;

/** The footprint of every vessel, as discs along its axis. */
export function vesselDiscs() {
  const along = (path: readonly Point[], radius: (share: number) => number) => {
    const line = curve(path);
    return Arr.map(Arr.range(0, STRETCHES), (step) => {
      const share = step / STRETCHES;
      const point = line.getPointAt(share);
      return { radius: radius(share), x: point.x, z: point.z };
    });
  };
  const lymph = Arr.map(Arr.range(0, STRETCHES), (step) => {
    const share = step / STRETCHES;
    return {
      radius: outer(LYMPH),
      x:
        LYMPH_PATH.start[0] + (LYMPH_PATH.end[0] - LYMPH_PATH.start[0]) * share,
      z: LYMPH_PATH.start[2],
    };
  });
  return [
    ...along(ARTERIOLE_PATH, arterioleRadius),
    ...along(VENULE_PATH, venuleRadius),
    ...Arr.flatMap(CAPILLARIES, (capillary) =>
      along(capillary.path, () => outer(CAPILLARY))
    ),
    ...lymph,
  ];
}

/** Whether two discs of the footprint keep at least `gap` apart. */
export function apart(first: Disc, second: Disc, gap: number) {
  return (
    Math.hypot(first.x - second.x, first.z - second.z) >=
    first.radius + second.radius + gap
  );
}

/**
 * The tissue cells between the vessels: each about 12 to 16 micrometres
 * across, as body cells are 10 to 100 (OpenStax Biology 2e, 4.2), flattened
 * a little as they rest on the floor, with a nucleus about 7 micrometres
 * across (BioNumbers 100440: 7.5, range 5 to 10). They fill the gaps on a
 * jittered grid, never touching a vessel or each other, and none lies more
 * than 30 micrometres from a capillary, as no working cell does (Guyton and
 * Hall, 13th ed., Chapter 16).
 */
export function tissueCells() {
  const vessels = vesselDiscs();
  const capillaries = Arr.flatMap(CAPILLARIES, (capillary) => {
    const line = curve(capillary.path);
    return Arr.map(Arr.range(0, STRETCHES), (step) => {
      const point = line.getPointAt(step / STRETCHES);
      return { radius: outer(CAPILLARY), x: point.x, z: point.z };
    });
  });
  const spacing = 0.5;
  const columns = Math.floor((BLOCK.right - BLOCK.left) / spacing);
  const rows = Math.floor((BLOCK.front - BLOCK.back) / spacing);
  const candidates = Arr.flatMap(Arr.range(0, rows - 1), (row) =>
    Arr.map(Arr.range(0, columns - 1), (column) => {
      const seed = row * 97 + column;
      return {
        radius: (12 + 4 * hashUnit(seed, 3)) / 2 / MICRONS,
        seed,
        x:
          BLOCK.left +
          spacing * (column + 0.5 + 0.8 * (hashUnit(seed, 5) - 0.5)),
        z: BLOCK.back + spacing * (row + 0.5 + 0.8 * (hashUnit(seed, 7) - 0.5)),
      };
    })
  );
  return Arr.reduce(
    candidates,
    Arr.empty<(typeof candidates)[number]>(),
    (kept, cell) => {
      const inside =
        cell.x - cell.radius > BLOCK.left + 0.2 &&
        cell.x + cell.radius < BLOCK.right - 0.2 &&
        cell.z - cell.radius > BLOCK.back + 0.2 &&
        cell.z + cell.radius < BLOCK.front - 0.2;
      const near = Arr.some(
        capillaries,
        (disc) => Math.hypot(cell.x - disc.x, cell.z - disc.z) < 3 + cell.radius
      );
      const clear =
        Arr.every(vessels, (disc) => apart(cell, disc, 0.12)) &&
        Arr.every(kept, (other) => apart(cell, other, 0.1));
      return inside && near && clear ? [...kept, cell] : kept;
    }
  );
}

/** How high a tissue cell stands over its footprint radius: cells resting in tissue are flattened. */
export const FLATTEN = 0.62;
