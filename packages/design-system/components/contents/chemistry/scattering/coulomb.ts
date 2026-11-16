import { Array as Arr, Option } from "effect";

/**
 * The Coulomb constant times the elementary charge squared, in MeV times
 * femtometres: e^2 / (4 pi epsilon_0) = 1.44 MeV fm (CODATA 2018, rounded).
 */
const COULOMB = 1.44;

/** The charge number of an alpha particle, a helium nucleus. */
const ALPHA_CHARGE = 2;

/** The charge number of gold, the foil Geiger and Marsden fired at. */
export const GOLD_CHARGE = 79;

/** The radius of a gold nucleus, about 1.2 fm times the cube root of 197. */
export const GOLD_NUCLEUS = 1.2 * Math.cbrt(197);

/**
 * How close an alpha particle of `energy` MeV comes to a nucleus of charge
 * number `charge` when it flies straight at it, in femtometres: there all its
 * kinetic energy has turned into electric potential energy.
 */
export function closestApproach(energy: number, charge: number) {
  return (COULOMB * ALPHA_CHARGE * charge) / energy;
}

/**
 * How far an alpha particle turns, in radians, when it passes a nucleus at
 * impact parameter `impact`, its sideways miss distance, from the Rutherford
 * relation tan(theta / 2) = d / (2b). A straight-on hit turns it right round.
 */
export function deflection(impact: number, approach: number) {
  return 2 * Math.atan2(approach, 2 * Math.abs(impact));
}

/**
 * The path of one alpha particle past a nucleus at the origin, a branch of a
 * hyperbola, as points (x, y) in femtometres, inside the square from -`limit`
 * to `limit`, starting on its left edge at the particle's height. The particle comes in from the left at height `impact` and is
 * pushed away: the polar equation of the repulsive Coulomb orbit is
 * 1/r = sin(phi) / b + d (cos(phi) - 1) / (2 b^2), where phi runs from the
 * incoming direction to the outgoing one, pi - theta.
 */
export function alphaPath(
  impact: number,
  approach: number,
  limit: number,
  samples: number
) {
  const b = Math.abs(impact);
  const side = impact < 0 ? -1 : 1;
  if (b === 0) {
    const turn = approach;
    return [
      [-limit, 0],
      [-turn, 0],
      [-limit, 0],
    ] as const satisfies readonly (readonly [number, number])[];
  }
  const sweep = Math.PI - deflection(b, approach);
  const inside = Arr.flatMap(Arr.range(1, samples - 1), (step) => {
    const phi = (sweep * step) / samples;
    const inverse =
      Math.sin(phi) / b + (approach * (Math.cos(phi) - 1)) / (2 * b * b);
    const x = -Math.cos(phi) / inverse;
    const y = (side * Math.sin(phi)) / inverse;
    return inverse > 0 && Math.abs(x) <= limit && Math.abs(y) <= limit
      ? [[x, y] as const]
      : [];
  });
  // Far from the nucleus the path runs on its incoming line, y = b, so the
  // beam enters the view from the left edge in one even column.
  return Arr.prepend(inside, [-limit, side * b] as const);
}

/** A point of a path in the plane of the scattering. */
type Planar = readonly [number, number];

/** How far along a path each of its points lies, from 0 at the first. */
export function cumulativeLengths(path: readonly Planar[]) {
  return Arr.scan(
    Arr.zip(path, Arr.drop(path, 1)),
    0,
    (total, [[ax, ay], [bx, by]]) => total + Math.hypot(bx - ax, by - ay)
  );
}

/**
 * The point `distance` along a path whose cumulative lengths are `lengths`,
 * between the two points it falls between, or the last point past the end.
 */
export function pointAlong(
  path: readonly Planar[],
  lengths: readonly number[],
  distance: number
): Planar {
  const last = Arr.getUnsafe(path, path.length - 1);
  return Option.match(
    Arr.findFirstIndex(lengths, (length) => length >= distance),
    {
      onNone: () => last,
      onSome: (index) => {
        if (index === 0) {
          return Arr.getUnsafe(path, 0);
        }
        const [ax, ay] = Arr.getUnsafe(path, index - 1);
        const [bx, by] = Arr.getUnsafe(path, index);
        const start = Arr.getUnsafe(lengths, index - 1);
        const end = Arr.getUnsafe(lengths, index);
        const share = (distance - start) / (end - start);
        return [ax + (bx - ax) * share, ay + (by - ay) * share];
      },
    }
  );
}

/**
 * How fast an alpha moves at `distance` from the nucleus, as a share of its
 * speed far away: its kinetic energy falls by the potential energy it gains,
 * so v / v0 = sqrt(1 - d / r). A floor keeps the head-on alpha moving
 * through its turning point instead of stopping there for ever.
 */
export function alphaSpeed(distance: number, approach: number) {
  return Math.sqrt(Math.max(0.04, 1 - approach / Math.max(distance, approach)));
}
