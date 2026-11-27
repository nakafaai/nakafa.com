import { useThree } from "@react-three/fiber";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";

type Point = readonly [number, number, number];

/**
 * The camera of a reading: it looks at the place on the scale where the
 * reading is taken, from `wide` on a landscape card and from `narrow` on a
 * phone's square card, close enough that the graduations are legible at both
 * sizes. A reader may orbit, come closer, and pull back `back` times as far
 * to see the whole instrument and what it measures.
 *
 * @param target - The place on the scale the reading is taken at
 * @param wide - Where the camera stands on a landscape card
 * @param narrow - Where the camera stands on a phone
 * @param back - How many times farther a reader may pull back
 * @param surface - The height of what the instrument lies on, which lifts every point
 */
export function ReadingCamera({
  back = 3,
  narrow,
  surface = 0,
  target,
  wide,
}: {
  readonly back?: number;
  readonly narrow: Point;
  readonly surface?: number;
  readonly target: Point;
  readonly wide: Point;
}) {
  const phone = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  const from = phone ? narrow : wide;
  const distance = Math.hypot(
    from[0] - target[0],
    from[1] - target[1],
    from[2] - target[2]
  );

  return (
    <CameraControls
      cameraPosition={[from[0], from[1] + surface, from[2]]}
      cameraTarget={[target[0], target[1] + surface, target[2]]}
      fov={36}
      maxDistance={distance * back}
      maxPolarAngle={Math.PI * 0.49}
      minDistance={distance * 0.4}
    />
  );
}
