import { useParabolicMotion } from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/context";
import {
  getProjectilePoint,
  getProjectileSceneY,
  PARABOLIC_SCENE,
  type ParabolicMotionState,
  type VectorTuple,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/data";
import { getColor } from "@repo/design-system/lib/color";
import { Vector3 } from "three";

const GROUND_COLORS = {
  landingMat: getColor("SLATE", 200),
  launcherBase: getColor("SLATE", 600),
  launcherRail: getColor("SLATE", 700),
};

/** What stands on the range the ball flies over: the landing mat and the launch ramp. */
export function ProjectileRange() {
  const motion = useParabolicMotion();
  const end = getProjectilePoint(motion, motion.flightTime);

  return (
    <group>
      <mesh position={[end.x, 0.03, 0]} receiveShadow>
        <boxGeometry args={[0.85, 0.05, 1.1]} />
        <meshStandardMaterial
          color={GROUND_COLORS.landingMat}
          roughness={0.78}
        />
      </mesh>
      <LaunchRamp />
    </group>
  );
}

function LaunchRamp() {
  const motion = useParabolicMotion();
  const pose = getLaunchRampPose(motion);

  return (
    <group>
      <mesh position={[pose.base.x, 0.015, 0]} receiveShadow>
        <boxGeometry args={[0.62, 0.05, 0.72]} />
        <meshStandardMaterial
          color={GROUND_COLORS.launcherBase}
          roughness={0.58}
        />
      </mesh>
      <mesh castShadow position={[pose.base.x, pose.base.y / 2, -0.2]}>
        <cylinderGeometry args={[0.035, 0.035, pose.base.y, 16]} />
        <meshStandardMaterial
          color={GROUND_COLORS.launcherBase}
          roughness={0.45}
        />
      </mesh>
      <mesh castShadow position={[pose.base.x, pose.base.y / 2, 0.2]}>
        <cylinderGeometry args={[0.035, 0.035, pose.base.y, 16]} />
        <meshStandardMaterial
          color={GROUND_COLORS.launcherBase}
          roughness={0.45}
        />
      </mesh>
      <group position={pose.center} rotation={[0, 0, pose.angle]}>
        <mesh castShadow position={[0, 0, -0.14]}>
          <boxGeometry args={[pose.length, 0.055, 0.045]} />
          <meshStandardMaterial
            color={GROUND_COLORS.launcherRail}
            roughness={0.34}
          />
        </mesh>
        <mesh castShadow position={[0, 0, 0.14]}>
          <boxGeometry args={[pose.length, 0.055, 0.045]} />
          <meshStandardMaterial
            color={GROUND_COLORS.launcherRail}
            roughness={0.34}
          />
        </mesh>
      </group>
    </group>
  );
}

function getLaunchRampPose(motion: ParabolicMotionState) {
  const start = getProjectilePoint(motion, 0);
  const angle = motion.angleRadians;
  const length = getLauncherLength(angle);
  const launchY = getProjectileSceneY(start.y);
  const base = {
    x: start.x - Math.cos(angle) * length,
    y: launchY - Math.sin(angle) * length,
  };
  const center = new Vector3((start.x + base.x) / 2, (launchY + base.y) / 2, 0);
  const centerTuple: VectorTuple = [center.x, center.y, center.z];

  return {
    angle,
    base,
    center: centerTuple,
    length,
  };
}

/** Keeps the launch rail above the ground while preserving the launch angle. */
function getLauncherLength(angle: number) {
  const minimumSine = 0.1;
  const safeSine = Math.max(Math.sin(angle), minimumSine);
  const maximumGroundedLength = PARABOLIC_SCENE.ballRadius / safeSine;

  return Math.min(PARABOLIC_SCENE.launcherLength, maximumGroundedLength * 0.9);
}
