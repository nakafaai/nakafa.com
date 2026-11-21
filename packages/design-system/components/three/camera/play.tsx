import { useThree } from "@react-three/fiber";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { useEffect } from "react";

/**
 * Whether the card's play action turns the camera, for the auto rotation of its orbit
 * controls. Only passive showcase and coordinate scenes opt in (`enabled = true`);
 * interactive simulations keep the camera steady while their own physics or process
 * runs. `ThreeCanvas` drives paced frames while `playing` is true, and this wakes the
 * canvas immediately when orbit-on-play turns on.
 *
 * @see https://r3f.docs.pmnd.rs/advanced/scaling-performance#on-demand-rendering
 */
export function useCameraPlay(enabled = false) {
  const playing = useVisualScene((state) => state.playing, false);
  const invalidate = useThree((state) => state.invalidate);
  const active = enabled && playing;

  useEffect(() => {
    if (active) {
      invalidate();
    }
  }, [active, invalidate]);

  return active;
}
