import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { type ComponentRef, useLayoutEffect, useRef } from "react";

/**
 * A camera that rides along beside a moving subject, as a tracking shot from
 * a car alongside does. Each frame it moves the camera and its orbit target by
 * however far `follow` says the subject moved, so the learner can still turn
 * and zoom around the subject while it travels. Reset view puts the camera
 * back at `offset` from the subject.
 */
export function FollowCamera({
  depth = 0,
  follow,
  lookAhead = 0,
  maxDistance,
  minDistance,
  offset,
}: {
  /** How far across the road the subject drives, in metres. */
  readonly depth?: number;
  /** Where the subject is along the road now, in metres. */
  readonly follow: () => number;
  /** How far ahead of the subject the camera looks, in metres. */
  readonly lookAhead?: number;
  readonly maxDistance: number;
  readonly minDistance: number;
  /** The camera's place relative to the subject, in metres. */
  readonly offset: readonly [number, number, number];
}) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const view = useVisualScene((card) => card.view, 0);
  const last = useRef(0);
  const shownView = useRef(view);

  // Reset view, and the first frame, set the pose; the learner owns it after.
  useLayoutEffect(() => {
    shownView.current = view;
    const x = follow();
    last.current = x;
    camera.position.set(x + offset[0], offset[1], depth + offset[2]);
    controls.current?.target.set(x + lookAhead, 0.8, depth);
    controls.current?.update();
    invalidate();
  }, [camera, depth, follow, invalidate, lookAhead, offset, view]);

  useFrame(() => {
    const x = follow();
    const moved = x - last.current;
    last.current = x;
    if (moved === 0 || !controls.current) {
      return;
    }
    camera.position.x += moved;
    controls.current.target.x += moved;
    controls.current.update();
  });

  return (
    <OrbitControls
      enableDamping
      enablePan={false}
      makeDefault
      maxDistance={maxDistance}
      maxPolarAngle={Math.PI / 2 - 0.06}
      minDistance={minDistance}
      ref={controls}
    />
  );
}
