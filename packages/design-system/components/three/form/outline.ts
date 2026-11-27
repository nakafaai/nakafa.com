import { Array as Arr } from "effect";

/** Points along a quarter turn: the engine rounds them into one curve. */
const STEPS = 12;

/**
 * The outline of a round bottom, from its pole on the axis out and up to its
 * rim: the bottom of a test tube, a flask or a bowl. An outline that goes on
 * up a wall carries on from its last point.
 *
 * @param radius - The rim's radius
 * @param depth - How far the rim stands above the pole
 */
export function bowl(radius: number, depth: number) {
  return Arr.makeBy(STEPS + 1, (step) => {
    const lean = (step / STEPS) * (Math.PI / 2);
    return [
      step === 0 ? 0 : Math.sin(lean) * radius,
      depth - Math.cos(lean) * depth,
    ] as const;
  });
}

/**
 * The outline of a flanged dished head: the end of a pressure vessel, a
 * converter or a tank. A bolting flange stands `out` past the rim and
 * `deep` up from the joint, flat on top for its bolts, and the dome rises
 * from the flange to its pole `height` above the joint, where it closes on
 * the axis.
 *
 * @param radius - The rim's radius
 * @param height - How far the pole stands above the joint
 * @param flange - How far the flange stands out past the rim, and how deep it is
 */
export function head(
  radius: number,
  height: number,
  [out, deep]: readonly [number, number]
) {
  const dome = Arr.map(
    Arr.reverse(bowl(radius, height - deep)),
    ([across, up]) => [across, height - up] as const
  );
  return [[radius + out, 0], [radius + out, deep], ...dome] as const;
}
