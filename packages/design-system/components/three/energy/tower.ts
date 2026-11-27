import { Array as Arr } from "effect";

/**
 * The tubular steel tower of a wind turbine in profile: rolled sections
 * that taper toward the top, bolted together through flanges that show as
 * raised bands, on a wider base flange bolted to the foundation.
 */

/** Where the tower's sections are bolted together, as shares of its height. */
const JOINTS = [0.27, 0.53, 0.78] as const;

/** How far a flange stands out of the shell, in foot radii. */
const LIP = 0.07;

/** Half the height of a flange band, in tower heights. */
const BAND = 0.004;

/** The tower's radius at a share `along` its height. */
export function towerRadius(foot: number, top: number, along: number) {
  return foot + (top - foot) * along;
}

/**
 * The tower's outline from its foot to its top as radius and height pairs,
 * which a lathe turns into the shell.
 *
 * @param height - The tower's height
 * @param foot - Its radius at the foundation
 * @param top - Its radius under the nacelle
 */
export function towerProfile(height: number, foot: number, top: number) {
  const lip = foot * LIP;
  const band = height * BAND;
  const joints = Arr.flatMap(JOINTS, (share) => {
    const radius = towerRadius(foot, top, share);
    const at = share * height;
    return [
      [radius, at - band * 1.6],
      [radius + lip, at - band],
      [radius + lip, at + band],
      [radius, at + band * 1.6],
    ] as const;
  });
  return [
    [foot + lip * 2.4, 0],
    [foot + lip * 2.4, band * 2],
    [foot, band * 3.2],
    ...joints,
    [top, height - band * 3.2],
    [top + lip, height - band * 2],
    [top + lip, height],
  ] as const satisfies readonly (readonly [number, number])[];
}
