import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import type { ComponentRef } from "react";
import { useLayoutEffect, useRef } from "react";

/**
 * A camera that rides along beside a moving subject, as a tracking shot from
 * a car alongside does. Each frame it moves the camera and its orbit target by
 * however far `follow` says the subject moved, so the learner can still turn
 * and zoom around the subject while it travels. Reset view puts the camera
 * back at `offset` from the subject.
 */
export function FollowCamera({
  across,
  depth = 0,
  follow,
  lookAhead = 0,
  maxDistance,
  minDistance,
  offset,
}: {
  /** Where the subject is across its path now, in metres, when it also moves sideways as a boat on a current does. */
  readonly across?: () => number;
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
  const lastAcross = useRef(depth);
  const shownView = useRef(view);

  // Reset view, and the first frame, set the pose; the learner owns it after.
  useLayoutEffect(() => {
    shownView.current = view;
    const x = follow();
    const z = across === undefined ? depth : across();
    last.current = x;
    lastAcross.current = z;
    camera.position.set(x + offset[0], offset[1], z + offset[2]);
    controls.current?.target.set(x + lookAhead, 0.8, z);
    controls.current?.update();
    invalidate();
  }, [across, camera, depth, follow, invalidate, lookAhead, offset, view]);

  useFrame(() => {
    const x = follow();
    const z = across === undefined ? depth : across();
    const moved = x - last.current;
    const swayed = z - lastAcross.current;
    last.current = x;
    lastAcross.current = z;
    if ((moved === 0 && swayed === 0) || !controls.current) {
      return;
    }
    camera.position.x += moved;
    camera.position.z += swayed;
    controls.current.target.x += moved;
    controls.current.target.z += swayed;
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
