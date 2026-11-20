import { useFrame } from "@react-three/fiber";
import { routeAt } from "@repo/design-system/components/contents/biology/blood/run";
import { useRequired } from "@repo/design-system/hooks/required";
import type { RefObject } from "react";
import { createContext } from "react";
import type { Object3D } from "three";

/**
 * The run's clock, in seconds after Play, that every moving part of the test
 * reads each frame: the droppers, the pipette, the sticks, and the drops in
 * the row under test. The scene owns it and advances it while the card plays;
 * it rests at the finished test while the card stands still.
 */
export const RunClockContext = createContext<RefObject<number> | null>(null);

/** Reads the run's clock of the surrounding blood typing scene. */
export function useRunClock() {
  return useRequired(RunClockContext, "useRunClock");
}

/** A point of a lab scene, in metres. */
type Point = readonly [number, number, number];

/**
 * Moves the object in `ref` along `points` as the run's clock passes `keys`,
 * the time it reaches each point, arcing `hop` metres up while it travels
 * between two different points, as a hand lifts what it carries.
 */
export function useRoute(
  ref: RefObject<Object3D | null>,
  points: readonly Point[],
  keys: readonly number[],
  hop: number
) {
  const clock = useRunClock();
  useFrame(() => {
    const target = ref.current;
    if (target === null) {
      return;
    }
    const along = routeAt(clock.current, keys);
    const index = Math.floor(along);
    const share = along - index;
    const from = points[index];
    const to = points[Math.min(index + 1, points.length - 1)];
    if (from === undefined || to === undefined) {
      return;
    }
    const moving = from[0] !== to[0] || from[2] !== to[2] ? 1 : 0;
    target.position.set(
      from[0] + (to[0] - from[0]) * share,
      from[1] +
        (to[1] - from[1]) * share +
        hop * moving * Math.sin(Math.PI * share),
      from[2] + (to[2] - from[2]) * share
    );
  });
}
