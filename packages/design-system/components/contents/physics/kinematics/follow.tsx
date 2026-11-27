import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { ROAD } from "@repo/design-system/components/contents/physics/kinematics/road";
import { sightOver } from "@repo/design-system/components/contents/physics/kinematics/sight";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { Array as Arr } from "effect";
import type { ComponentRef } from "react";
import { useLayoutEffect, useMemo, useRef } from "react";
import { PerspectiveCamera } from "three";

/** A place in a scene, or a direction in it, in metres. */
type Place = readonly [x: number, y: number, z: number];

/** How much of the frame a lab's subject may span: the rest is the margin around it. */
const FILL = 0.92;

/**
 * Where a camera stands and what it looks at so that every one of `points`
 * is in the frame it draws into, as near as that frame allows, while it
 * looks along `toward`. The frame's shape is read from the canvas, so a
 * phone and a desk both get the subject across their whole frame. Both
 * `points` and `toward` are kept by their caller between renders.
 *
 * @param points - Every place that must stay in the frame, in metres
 * @param toward - The way the camera looks, never straight up or down
 * @param fov - The camera's vertical angle of view, in degrees
 */
export function useSight(points: readonly Place[], toward: Place, fov: number) {
  const shape = useThree((state) => state.size.width / state.size.height);
  return useMemo(
    () => sightOver(points, toward, { fill: FILL, fov, shape }),
    [fov, points, shape, toward]
  );
}

/**
 * How a roadside camera looks: down by `TILT`, across the road by `YAW`
 * from the way the road runs, both in radians, through an angle of view of
 * `VIEW` degrees. It looks down more steeply than half its angle of view,
 * so its frame holds road, verge and grass and never the horizon.
 */
const TILT = (27 * Math.PI) / 180;
const YAW = (30 * Math.PI) / 180;
const VIEW = 44;

/** How high the frame reaches over the road, in metres: a car and the label of a post. */
const HEADROOM = 1.8;

/**
 * A camera on a mast at the verge past one end of a measured stretch of
 * road, looking back along it and down: what has just driven the stretch
 * fills the foreground, and the stretch runs from there to its far end
 * across the whole frame. It stands as near as the frame allows, so a short
 * stretch brings it close and a long one moves it out.
 *
 * @param from - The far end of the stretch along the road, in metres
 * @param past - How far past the near end the frame reaches, in metres: room for what stands or has driven there
 * @param to - The end the camera stands past, in metres
 * @param resetKey - Changes when the stretch does, so the view starts over
 */
export function RoadsideCamera({
  from,
  past,
  resetKey,
  to,
}: {
  readonly from: number;
  readonly past: number;
  readonly resetKey: number | string;
  readonly to: number;
}) {
  const toward = to < from ? -1 : 1;
  const points = useMemo(
    () =>
      Arr.flatMap([from, to + toward * past], (x) =>
        Arr.flatMap([0, HEADROOM], (y) => [
          [x, y, -(ROAD.halfWidth + 1.2)] as const,
          [x, y, ROAD.halfWidth + 0.4] as const,
        ])
      ),
    [from, past, to, toward]
  );
  const line = useMemo(
    () =>
      [
        -toward * Math.cos(YAW) * Math.cos(TILT),
        -Math.sin(TILT),
        -Math.sin(YAW) * Math.cos(TILT),
      ] as const,
    [toward]
  );
  const sight = useSight(points, line, VIEW);

  return (
    <CameraControls
      cameraPosition={sight.position}
      cameraTarget={sight.target}
      fov={VIEW}
      maxPolarAngle={Math.PI / 2 - TILT + 0.05}
      resetKey={resetKey}
    />
  );
}

/** Where a following camera looks when a lab names no other place: at the subject, 0.8 m up. */
const AT_SUBJECT = [0, 0.8, 0] as const;

/**
 * A camera that rides along beside a moving subject, as a tracking shot from
 * a car alongside does. Each frame it moves the camera and its orbit target by
 * however far `follow` says the subject moved, so the learner can still turn
 * and zoom around the subject while it travels. Reset view puts the camera
 * back at `offset` from the subject, looking at `aim`.
 */
export function FollowCamera({
  across,
  aim = AT_SUBJECT,
  depth = 0,
  follow,
  fov,
  maxDistance,
  minDistance,
  offset,
}: {
  /** Where the subject is across its path now, in metres, when it also moves sideways as a boat on a current does. */
  readonly across?: () => number;
  /** The place the camera looks at, relative to the subject, in metres. */
  readonly aim?: Place;
  /** How far across the road the subject drives, in metres. */
  readonly depth?: number;
  /** Where the subject is along the road now, in metres. */
  readonly follow: () => number;
  /** The camera's vertical angle of view, in degrees, when a lab has fitted its view to one. */
  readonly fov?: number;
  readonly maxDistance: number;
  readonly minDistance: number;
  /** The camera's place relative to the subject, in metres. */
  readonly offset: Place;
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
    if (fov !== undefined && camera instanceof PerspectiveCamera) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    camera.position.set(x + offset[0], offset[1], z + offset[2]);
    controls.current?.target.set(x + aim[0], aim[1], z + aim[2]);
    controls.current?.update();
    invalidate();
  }, [across, aim, camera, depth, follow, fov, invalidate, offset, view]);

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
