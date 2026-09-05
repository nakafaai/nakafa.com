import {
  type CameraProjection,
  resolveCameraDistanceLimits,
} from "@repo/design-system/lib/geometry/camera";

import type {
  SpacePoint,
  SpaceVisual,
} from "@/lib/content/renderer/client/base/visual/scene";
import {
  projectSpaceFrame,
  projectSpaceMeasure,
  projectSpacePoint,
  resolveSpaceProjection,
} from "@/lib/content/renderer/client/base/visual/transform";

const CAMERA_DISTANCE_RATIO = 2.4;
const CAMERA_HEIGHT_RATIO = 0.7;
const CAMERA_FAR_RATIO = 8;
const CAMERA_MIN_DISTANCE_RATIO = 1000;
const CAMERA_NEAR_RATIO = 10_000;
const ISOMETRIC_VIEW_HEIGHT_RATIO = 2.4;
function numericFrameExtent(frame: ReturnType<typeof projectSpaceFrame>) {
  return Math.max(
    frame.x.max - frame.x.min,
    frame.y.max - frame.y.min,
    frame.z.max - frame.z.min
  );
}

function frameCenter(frame: ReturnType<typeof projectSpaceFrame>) {
  return {
    x: (frame.x.min + frame.x.max) / 2,
    y: (frame.y.min + frame.y.max) / 2,
    z: (frame.z.min + frame.z.max) / 2,
  };
}

function pointTuple({ x, y, z }: SpacePoint): [number, number, number] {
  return [x, y, z];
}

function cameraEnvelope(
  extent: number,
  position: readonly [number, number, number],
  target: readonly [number, number, number]
) {
  const distance = Math.hypot(
    position[0] - target[0],
    position[1] - target[1],
    position[2] - target[2]
  );
  const scale = Math.max(extent, distance, Number.EPSILON);
  const nearScale = Math.max(Math.min(extent, distance), Number.EPSILON);

  return {
    controls: resolveCameraDistanceLimits({
      minDistance: nearScale / CAMERA_MIN_DISTANCE_RATIO,
      position,
      target,
    }),
    far: scale * CAMERA_FAR_RATIO,
    near: nearScale / CAMERA_NEAR_RATIO,
  };
}

/** Resolves a semantic authored view into one explicit safe camera setup. */
export function resolveSpaceView(
  scene: SpaceVisual,
  projection = resolveSpaceProjection(scene)
): {
  readonly controls: {
    readonly maxDistance: number;
    readonly minDistance: number;
  };
  readonly position: [number, number, number];
  readonly projection: CameraProjection;
  readonly target: [number, number, number];
} {
  const frame = projectSpaceFrame(scene.frame, projection);
  const extent = numericFrameExtent(frame);
  if (scene.view.kind === "camera") {
    const position = pointTuple(
      projectSpacePoint(scene.view.position, projection)
    );
    const target = pointTuple(projectSpacePoint(scene.view.target, projection));
    const envelope = cameraEnvelope(extent, position, target);
    return {
      controls: envelope.controls,
      position,
      projection: {
        far: envelope.far,
        kind: "perspective",
        near: envelope.near,
      },
      target,
    };
  }

  const target =
    scene.view.kind === "isometric" && scene.view.target
      ? projectSpacePoint(scene.view.target, projection)
      : frameCenter(frame);
  const padding =
    scene.view.kind === "fit"
      ? projectSpaceMeasure(scene.view.padding ?? 0, projection)
      : 0;
  const paddedExtent = extent + 2 * padding;
  const distance = paddedExtent * CAMERA_DISTANCE_RATIO;
  const position =
    scene.view.kind === "isometric"
      ? ([
          target.x + distance,
          target.y + distance,
          target.z + distance,
        ] satisfies [number, number, number])
      : ([
          target.x + distance,
          target.y + distance * CAMERA_HEIGHT_RATIO,
          target.z + distance,
        ] satisfies [number, number, number]);
  const targetTuple = pointTuple(target);
  const envelope = cameraEnvelope(paddedExtent, position, targetTuple);
  return {
    controls: envelope.controls,
    position,
    projection:
      scene.view.kind === "isometric"
        ? {
            far: envelope.far,
            kind: "orthographic",
            near: envelope.near,
            viewHeight: paddedExtent * ISOMETRIC_VIEW_HEIGHT_RATIO,
          }
        : { far: envelope.far, kind: "perspective", near: envelope.near },
    target: targetTuple,
  };
}
