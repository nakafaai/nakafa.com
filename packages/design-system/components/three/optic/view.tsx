import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import type { CoordinateFrame } from "@repo/design-system/components/three/frame";
import type { ReactNode } from "react";

/** The camera's field of view, in degrees: long enough that rays in one plane read as a diagram. */
const FOV = 30;

/**
 * The nearest the camera draws, in scene units. A fitted camera would
 * otherwise draw from a hair's breadth away, which leaves too little depth
 * to tell a felt from the board under it.
 */
const NEAR = 0.05;

/**
 * The view of an optics lab. The lab names the box its reading happens in,
 * such as a bench from its source to its screen, and the side it is read
 * from; the camera then stands as close as the card's frame allows with the
 * whole box inside it, at any width and aspect, and comes closer or steps
 * back when the box changes. Everything the lab draws goes inside, so only
 * the box decides the framing and a benchtop or a backdrop never does. A
 * reader may still orbit and zoom.
 *
 * @param box - What the frame must hold, in scene units
 * @param from - The direction the camera looks from, as a step away from the middle of the box
 */
export function View({
  box,
  children,
  from,
}: {
  readonly box: CoordinateFrame;
  readonly children: ReactNode;
  readonly from: readonly [number, number, number];
}) {
  const middle = [
    (box.x.min + box.x.max) / 2,
    (box.y.min + box.y.max) / 2,
    (box.z.min + box.z.max) / 2,
  ] as const;

  return (
    <>
      <CameraControls
        cameraPosition={[
          middle[0] + from[0],
          middle[1] + from[1],
          middle[2] + from[2],
        ]}
        cameraTarget={middle}
        fov={FOV}
        framing="content"
        maxPolarAngle={Math.PI * 0.49}
        projection={{ kind: "perspective", near: NEAR }}
      />
      <CameraBounds bounds={box}>{children}</CameraBounds>
    </>
  );
}
