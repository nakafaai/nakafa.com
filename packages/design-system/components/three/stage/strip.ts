import { Array as Arr } from "effect";

/** A place on the ground: across and along, in scene units. */
type Place = readonly [x: number, z: number];

/** The unit direction from one place to the next. */
function heading(from: Place, to: Place): Place {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  return [(to[0] - from[0]) / length, (to[1] - from[1]) / length];
}

/**
 * The band a path sweeps over flat ground, as the numbers of a mesh: a strip
 * that follows the path between two offsets to its side, mitred at every bend
 * so its width holds. `u` counts the distance along the path in scene units,
 * so a texture that repeats lays evenly whatever the length, and `v` runs
 * from 0 at `from` to 1 at `to`. A closed path meets its own start. Every
 * triangle faces up.
 *
 * @param path - The places the path passes, each apart from the next
 * @param closed - Whether the path returns from its last place to its first
 * @param from - The offset of one edge to the side of the path
 * @param to - The offset of the other edge, greater than `from`
 */
export function pathStrip(
  path: readonly Place[],
  closed: boolean,
  from: number,
  to: number
) {
  const places = closed ? Arr.append(path, path[0]) : path;
  const last = places.length - 1;
  const headings = Arr.makeBy(last, (index) =>
    heading(places[index], places[index + 1])
  );
  const positions = new Float32Array(places.length * 6);
  const uvs = new Float32Array(places.length * 4);
  let travelled = 0;
  Arr.forEach(places, (place, index) => {
    const before =
      headings[index === 0 && closed ? last - 1 : Math.max(index - 1, 0)];
    const after =
      headings[index === last && closed ? 0 : Math.min(index, last - 1)];
    // The side of a bend is the mean of the sides of its two legs, stretched
    // so the strip keeps its width on both of them.
    const side = [-(before[1] + after[1]), before[0] + after[0]] as const;
    const stretch = 2 / (side[0] * side[0] + side[1] * side[1]);
    if (index > 0) {
      travelled += Math.hypot(
        place[0] - places[index - 1][0],
        place[1] - places[index - 1][1]
      );
    }
    positions.set(
      [
        place[0] + side[0] * stretch * from,
        0,
        place[1] + side[1] * stretch * from,
        place[0] + side[0] * stretch * to,
        0,
        place[1] + side[1] * stretch * to,
      ],
      index * 6
    );
    uvs.set([travelled, 0, travelled, 1], index * 4);
  });
  const indices = Arr.flatMap(
    Arr.makeBy(last, (index) => index * 2),
    (near) => [near, near + 1, near + 2, near + 2, near + 1, near + 3]
  );

  return { indices, length: travelled, positions, uvs };
}

/**
 * A path with places added along its legs, so no leg is longer than `step`:
 * a strip built on it bends with the ground under it. The path keeps its
 * shape, and a closed one still returns from its last place to its first.
 */
export function densePath(
  path: readonly Place[],
  closed: boolean,
  step: number
) {
  const legs = closed ? path.length : path.length - 1;
  const places = Arr.flatMap(
    Arr.makeBy(legs, (index) => index),
    (index) => {
      const from = path[index];
      const to = path[(index + 1) % path.length];
      const pieces = Math.max(
        1,
        Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / step)
      );
      return Arr.makeBy(
        pieces,
        (piece): Place => [
          from[0] + ((to[0] - from[0]) * piece) / pieces,
          from[1] + ((to[1] - from[1]) * piece) / pieces,
        ]
      );
    }
  );
  return closed ? places : Arr.append(places, path[legs]);
}

/** The places of a circle of one radius around the middle, as a closed path of `steps` legs. */
export function circlePath(radius: number, steps: number) {
  return Arr.makeBy(steps, (index): Place => {
    const angle = (index / steps) * 2 * Math.PI;
    return [radius * Math.cos(angle), radius * Math.sin(angle)];
  });
}

/**
 * A path carried on from both of its ends, straight along its first and last
 * legs, by `far`: a road that runs past the lab has no end to see.
 */
export function throughPath(path: readonly Place[], far: number) {
  const end = path.length - 1;
  const out = heading(path[1], path[0]);
  const on = heading(path[end - 1], path[end]);
  const first = path[0];
  const final = path[end];
  return [
    [first[0] + out[0] * far, first[1] + out[1] * far] as const,
    ...path,
    [final[0] + on[0] * far, final[1] + on[1] * far] as const,
  ];
}
