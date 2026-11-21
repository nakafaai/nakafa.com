import { addAfterEffect, useFrame, useThree } from "@react-three/fiber";
import { useCameraFraming } from "@repo/design-system/components/three/camera/framing";
import {
  isSceneOverlayReady,
  useSceneOverlayStoreOptional,
} from "@repo/design-system/components/three/overlay";
import { useEffect, useEffectEvent, useRef } from "react";

/**
 * Frames a scene may draw after its camera's first fit while fits keep coming,
 * before it shows anyway. A scene whose labels move with its animation, or
 * keep measuring, asks for a fit on every frame; its first view is fitted by
 * then, and the fits after it only follow the labels.
 */
const SETTLE_FRAMES = 15;

/**
 * Tells its canvas once the scene is drawn whole. It stands last inside the
 * canvas's Suspense boundary, so it mounts only when every part of the scene
 * has what it suspends for: its code, and the models, textures and
 * environments its loaders bring. It then waits for a frame drawn where the
 * camera stands as the scene's subjects put it: the first fit is done and no
 * fit waits, or `SETTLE_FRAMES` frames have passed since the first fit. The
 * canvas stays hidden behind its loading state until that frame, so a reader
 * never sees an empty canvas, a half-built scene or a camera that jumps to its
 * first view.
 *
 * While the frame is not whole, its frame callback asks for the next one.
 * Fiber keeps its loop running for a frame asked for inside a frame callback,
 * but drops one asked for in an after-effect of the loop's last frame: the loop
 * still counts as running then, so it requests no new frame and stops. A
 * scene whose last fit moved nothing would then wait behind its spinner for a
 * frame that never comes.
 *
 * It reads no loading manager: three's default one counts the loads of every
 * canvas on the page, so another scene's model would hold this one back, and a
 * load that never ends would hold it forever.
 *
 * Fiber's after-effects run once every canvas of the page has drawn its frame,
 * and this canvas's own frame callback marks whether the frame it drew was a
 * whole one, so another canvas drawing never reveals this one.
 *
 * @see https://r3f.docs.pmnd.rs/api/hooks#useframe
 */
export function SceneDrawn({ onDrawn }: { onDrawn: () => void }) {
  const framing = useCameraFraming();
  const overlay = useSceneOverlayStoreOptional();
  const invalidate = useThree((state) => state.invalidate);
  const fittedFrames = useRef(0);
  const whole = useRef(false);
  const told = useRef(false);
  const tell = useEffectEvent(onDrawn);

  useFrame(() => {
    if (told.current) {
      return;
    }
    const framingReady = framing ? framing.isSettled() : true;
    const overlayReady = overlay ? isSceneOverlayReady(overlay) : true;
    if (!framing || framing.hasFitted()) {
      fittedFrames.current += 1;
    }
    whole.current =
      (framingReady && overlayReady) || fittedFrames.current > SETTLE_FRAMES;
    if (!whole.current) {
      // The camera or its overlay labels still settle: draw again once ready.
      invalidate();
    }
  });

  useEffect(() => {
    const stop = addAfterEffect(() => {
      if (told.current || !whole.current) {
        return;
      }
      told.current = true;
      tell();
    });
    invalidate();
    return stop;
  }, [invalidate]);

  return null;
}
