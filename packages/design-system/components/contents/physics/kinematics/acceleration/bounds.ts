import type {
  ACCELERATION_ROCKET_MOTION,
  AccelerationMotionState,
} from "@repo/design-system/components/contents/physics/kinematics/acceleration/data";
import type { CoordinateFrame } from "@repo/design-system/components/three/frame";
import { Effect } from "effect";
import { Box3, type Group, Matrix4, Vector3 } from "three";

type RocketPose = Pick<
  typeof ACCELERATION_ROCKET_MOTION,
  "modelRotationY" | "yawAmplitude" | "rollAmplitude" | "rollPerAcceleration"
> & { scale: number };

/** Encloses the complete flight and authored sway without inventing tumbling. */
export const measureRocketMotionBounds = Effect.fn(
  "acceleration.measureRocketMotionBounds"
)(
  (
    model: Group,
    motion: Pick<
      AccelerationMotionState,
      "acceleration" | "startX" | "worldDisplacement"
    >,
    pose: RocketPose
  ) =>
    Effect.sync(() => {
      const bounds = new Box3().setFromObject(model);
      bounds.translate(bounds.getCenter(new Vector3()).negate());
      bounds.applyMatrix4(new Matrix4().makeRotationY(pose.modelRotationY));
      const half = bounds.getSize(new Vector3()).multiplyScalar(pose.scale / 2);
      const yawSine = Math.sin(pose.yawAmplitude);
      const rollSine = Math.sin(
        Math.abs(motion.acceleration * pose.rollPerAcceleration) +
          pose.rollAmplitude
      );

      // For the authored small Euler angles, |sin| stays below these bounds and
      // |cos| <= 1. The static pi reversal preserves the symmetric extents.
      const x = half.x + half.y * rollSine + half.z * yawSine;
      const y = half.x * rollSine + half.y;
      const z = (half.x + half.y * rollSine) * yawSine + half.z;

      return {
        x: {
          min: motion.startX - x,
          max: motion.startX + motion.worldDisplacement + x,
        },
        y: { min: -y, max: y },
        z: { min: -z, max: z },
      } satisfies CoordinateFrame;
    })
);
