import { useProgress } from "@react-three/drei";
import { addAfterEffect, useFrame, useThree } from "@react-three/fiber";
import { useCameraFraming } from "@repo/design-system/components/three/camera/framing";
import { useEffect, useEffectEvent, useRef } from "react";

/**
 * Tells its canvas once the scene is drawn whole. It stands last inside the
 * canvas's Suspense boundary, so it mounts only when every part of the scene
 * has its code; it then waits for a frame that three draws after its loaders
 * went quiet (environments, textures, models) and the camera stands where the
 * scene's subjects put it. The canvas stays hidden behind its loading state
 * until that frame, so a reader never sees an empty canvas, a half-built scene
 * or a camera that jumps to its first view.
 *
 * Fiber's after-effects run once every canvas of the page has drawn its frame,
 * and this canvas's own frame callback marks whether the frame it drew was a
 * whole one, so another canvas drawing never reveals this one.
 */
export function SceneDrawn({ onDrawn }: { onDrawn: () => void }) {
  const framing = useCameraFraming();
  const invalidate = useThree((state) => state.invalidate);
  const loading = useProgress((state) => state.active);
  const whole = useRef(false);
  const told = useRef(false);
  const tell = useEffectEvent(onDrawn);

  useFrame(() => {
    whole.current = !loading && (framing?.isSettled() ?? true);
  });

  useEffect(() => {
    if (loading) {
      return;
    }
    const stop = addAfterEffect(() => {
      if (told.current) {
        return;
      }
      if (!whole.current) {
        // The camera still fits: draw again once it has.
        invalidate();
        return;
      }
      told.current = true;
      tell();
    });
    invalidate();
    return stop;
  }, [invalidate, loading]);

  return null;
}
