import { useReducedMotion } from "@mantine/hooks";
import { useFrame, useThree } from "@react-three/fiber";
import { animate, motionValue } from "motion";
import { useEffect, useMemo } from "react";
import { Vector3 } from "three";
import { PIXELS_PER_UNIT } from "@/lib/island/view";

/** How high above its place the camera starts, in art pixels, and the seconds it takes to come down. */
const START_LIFT = 160;
const DESCENT_SECONDS = 1.6;

/**
 * The camera's way down to the island when its page opens (ADR 0042, D11):
 * it starts in the sky above and settles on the island, moving in whole art
 * pixels so every frame stays sharp. Motion drives it and asks for a frame at
 * each step; a reader who asks for less motion sees the island in place.
 */
export function Descent() {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const calm = useReducedMotion();
  const lift = useMemo(() => motionValue(calm ? 0 : START_LIFT), [calm]);
  const base = useMemo(() => camera.position.clone(), [camera]);
  const up = useMemo(
    () => new Vector3(0, 1, 0).applyEuler(camera.rotation),
    [camera]
  );
  useEffect(() => {
    const stop = lift.on("change", () => invalidate());
    const descent = animate(lift, 0, {
      duration: DESCENT_SECONDS,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => {
      stop();
      descent.stop();
    };
  }, [invalidate, lift]);
  useFrame(() => {
    camera.position
      .copy(base)
      .addScaledVector(up, Math.round(lift.get()) / PIXELS_PER_UNIT);
    camera.updateMatrixWorld();
  });
  return null;
}
