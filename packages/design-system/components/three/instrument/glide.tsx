import { useReducedMotion } from "@mantine/hooks";
import { useFrame, useThree } from "@react-three/fiber";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { eased } from "@repo/design-system/components/three/instrument/scale";
import { useRef } from "react";

/**
 * Moves a part of an instrument to a new reading the way a hand does: a
 * slide glides, a thimble turns, a needle settles. The part's pose is written
 * straight to the scene on each frame, so nothing renders again, and the
 * canvas draws only until the part arrives. A reader who asked for reduced
 * motion sees the part already there.
 *
 * @param target - The reading the part moves to
 * @param rate - How quickly it closes the distance, per second
 * @param pose - Writes the part's pose for a value on the way
 */
export function useGlide(
  target: number,
  rate: number,
  pose: (value: number) => void
) {
  const value = useRef(target);
  const calm = useReducedMotion(undefined, { getInitialValueInEffect: false });
  const invalidate = useThree((state) => state.invalidate);

  useFrame((_, delta) => {
    value.current = calm
      ? target
      : eased(value.current, target, rate, simulationStep(delta));
    pose(value.current);
    if (value.current !== target) {
      invalidate();
    }
  });
}
