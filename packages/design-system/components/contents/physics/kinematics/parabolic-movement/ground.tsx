import { RoundedBox } from "@react-three/drei";
import { useParabolicMotion } from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/context";
import type {
  ParabolicMotionState,
  VectorTuple,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/data";
import {
  getProjectilePoint,
  getProjectileSceneY,
  PARABOLIC_SCENE,
} from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/data";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { MACHINE_COLORS } from "@repo/design-system/lib/material/machine";
import { ROAD_COLORS } from "@repo/design-system/lib/material/road";
import { Array as Arr } from "effect";
import { Vector3 } from "three";

const BOLT_OFFSETS = [
  [-0.25, -0.3],
  [0.25, -0.3],
  [-0.25, 0.3],
  [0.25, 0.3],
] as const;

/** Beveled concrete target pad with bullseye rings and a cast-iron brass-railed launch ramp. */
export function ProjectileRange() {
  const motion = useParabolicMotion();
  const end = getProjectilePoint(motion, motion.flightTime);

  return (
    <group>
      <group position={[end.x, 0, 0]}>
        <RoundedBox
          args={[0.92, 0.055, 1.12]}
          castShadow
          position={[0, 0.028, 0]}
          radius={0.014}
          receiveShadow
          smoothness={2}
        >
          <SurfaceMaterial color={MACHINE_COLORS.concrete} surface="concrete" />
        </RoundedBox>
        <mesh position={[0, 0.057, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.24, 0.32, 48]} />
          <meshStandardMaterial
            color={ROAD_COLORS.roadPaint}
            roughness={0.74}
          />
        </mesh>
        <mesh position={[0, 0.058, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.08, 32]} />
          <meshStandardMaterial
            color={INSTRUMENT_COLORS.brass}
            roughness={0.4}
          />
        </mesh>
      </group>
      <LaunchRamp />
    </group>
  );
}

function LaunchRamp() {
  const motion = useParabolicMotion();
  const pose = getLaunchRampPose(motion);

  return (
    <group>
      <RoundedBox
        args={[0.66, 0.052, 0.76]}
        castShadow
        position={[pose.base.x, 0.026, 0]}
        radius={0.012}
        receiveShadow
        smoothness={2}
      >
        <MetalMaterial color={CAR_COLORS.castIron} roughness={0.46} />
      </RoundedBox>
      {Arr.map(BOLT_OFFSETS, ([bx, bz]) => (
        <mesh
          castShadow
          key={`${bx}-${bz}`}
          position={[pose.base.x + bx, 0.058, bz]}
        >
          <cylinderGeometry args={[0.022, 0.022, 0.016, 6]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
        </mesh>
      ))}
      {Arr.map([-0.2, 0.2] as const, (sz) => (
        <mesh
          castShadow
          key={sz}
          position={[pose.base.x, pose.base.y / 2 + 0.02, sz]}
        >
          <cylinderGeometry args={[0.034, 0.04, pose.base.y + 0.04, 20]} />
          <MetalMaterial color={INSTRUMENT_COLORS.aluminium} roughness={0.34} />
        </mesh>
      ))}
      <group position={pose.center} rotation={[0, 0, pose.angle]}>
        {Arr.map([-0.14, 0.14] as const, (rz) => (
          <RoundedBox
            args={[pose.length, 0.055, 0.045]}
            castShadow
            key={rz}
            position={[0, 0, rz]}
            radius={0.008}
            smoothness={2}
          >
            <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.28} />
          </RoundedBox>
        ))}
        <mesh castShadow position={[-pose.length / 2 + 0.03, 0, 0]}>
          <boxGeometry args={[0.05, 0.05, 0.34]} />
          <SurfaceMaterial color={CAR_COLORS.tyre} surface="rubber" />
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
