import { bowl } from "@repo/design-system/components/three/form/outline";
import { Array as Arr } from "effect";

/**
 * The outline of a ball that rests on its lower pole, for a part turned
 * about its axis: from the pole out and up round the ball to its upper pole.
 * A lens, a finial or a bolt's rounded head is one such ball, squashed or
 * not by its mesh.
 *
 * @param radius - The ball's radius
 */
export function ball(radius: number) {
  const lower = bowl(radius, radius);
  return Arr.appendAll(
    lower,
    Arr.map(
      Arr.drop(Arr.reverse(lower), 1),
      ([across, up]) => [across, 2 * radius - up] as const
    )
  );
}

/**
 * The outline of a dome that stands on its rim, for a part turned about its
 * axis: from the rim up to the pole on the axis. The glass of a beacon is
 * one.
 *
 * @param radius - The rim's radius
 * @param height - How far the pole stands above the rim
 */
export function dome(radius: number, height: number) {
  return Arr.map(
    Arr.reverse(bowl(radius, height)),
    ([across, up]) => [across, height - up] as const
  );
}
