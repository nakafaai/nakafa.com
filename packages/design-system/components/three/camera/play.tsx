"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useVisualScene } from "@repo/design-system/components/visual/card";

/**
 * Whether the card's play action turns the camera, for the auto rotation of its orbit
 * controls. With damping, auto rotation turns the camera less on its first frames than
 * OrbitControls reports as a change, so a canvas that renders on demand would stop after
 * one frame. While the card plays, each frame asks for the next one, and a paused canvas
 * ignores the request until it resumes.
 *
 * @see https://r3f.docs.pmnd.rs/advanced/scaling-performance#on-demand-rendering
 */
export function useCameraPlay() {
  const playing = useVisualScene((state) => state.playing, false);
  const invalidate = useThree((state) => state.invalidate);

  useFrame(() => {
    if (playing) {
      invalidate();
    }
  });

  return playing;
}
