import { useThree } from "@react-three/fiber";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";

type Point = readonly [number, number, number];

/**
 * The camera of a benchtop rig: it looks at `target` from `wide` on a
 * landscape card and steps back to `narrow` on a phone's square card, so the
 * whole rig stays inside the frame at both sizes. A reader may orbit and
 * dolly between half and twice the farther of the two distances.
 */
export function BenchCamera({
  narrow,
  target,
  wide,
}: {
  readonly narrow: Point;
  readonly target: Point;
  readonly wide: Point;
}) {
  const phone = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  const reach = Math.hypot(
    narrow[0] - target[0],
    narrow[1] - target[1],
    narrow[2] - target[2]
  );

  return (
    <CameraControls
      cameraPosition={phone ? narrow : wide}
      cameraTarget={target}
      fov={36}
      maxDistance={reach * 1.7}
      maxPolarAngle={Math.PI * 0.49}
      minDistance={reach * 0.35}
    />
  );
}
