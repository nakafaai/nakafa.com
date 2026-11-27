import { useFrame } from "@react-three/fiber";
import { useSimulationClock } from "@repo/design-system/components/contents/simulation/clock";
import { Glow } from "@repo/design-system/components/three/optic/beam";
import { useMemo, useRef } from "react";
import type { Group } from "three";

type Point = readonly [number, number, number];

/**
 * A short pulse of light running along a beam's path while the card plays,
 * so a reader sees which way the light goes and where it turns. It takes
 * `seconds` to run the whole path, then starts again at the source. It lies
 * flat, as a spot of scattered light on the board under the beam does.
 *
 * The lengths of the path are measured once per path, and a frame only
 * moves the one spot, so it allocates nothing while it runs.
 *
 * @param color - The colour of the light
 * @param points - The path the beam takes, of at least two points
 * @param seconds - How long the pulse takes to run the whole path
 * @param size - How wide the spot is
 */
export function Pulse({
  color,
  points,
  seconds,
  size,
}: {
  readonly color: string;
  readonly points: readonly Point[];
  readonly seconds: number;
  readonly size: number;
}) {
  const spot = useRef<Group>(null);
  const clock = useSimulationClock();
  const lengths = useMemo(() => {
    const each = new Float32Array(Math.max(points.length - 1, 0));
    let whole = 0;
    for (let index = 0; index < each.length; index += 1) {
      const start = points[index] ?? [0, 0, 0];
      const end = points[index + 1] ?? start;
      each[index] = Math.hypot(
        end[0] - start[0],
        end[1] - start[1],
        end[2] - start[2]
      );
      whole += each[index] ?? 0;
    }
    return { each, whole };
  }, [points]);

  useFrame((_, delta) => {
    const group = spot.current;
    if (group === null || lengths.whole === 0) {
      return;
    }
    let left = ((clock.advance(delta) / seconds) % 1) * lengths.whole;
    for (let index = 0; index < lengths.each.length; index += 1) {
      const long = lengths.each[index] ?? 0;
      const start = points[index];
      const end = points[index + 1];
      if (left <= long && start !== undefined && end !== undefined) {
        const share = long === 0 ? 0 : left / long;
        group.position.set(
          start[0] + (end[0] - start[0]) * share,
          start[1] + (end[1] - start[1]) * share,
          start[2] + (end[2] - start[2]) * share
        );
        return;
      }
      left -= long;
    }
  });

  return (
    <group ref={spot} visible={clock.playing}>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <Glow color={color} size={size} strength={1} />
      </group>
    </group>
  );
}
