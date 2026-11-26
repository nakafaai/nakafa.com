import { Line, useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  SpaceBackground,
  SpaceRocks,
  SpeedParticles,
  StarField,
} from "@repo/design-system/components/contents/physics/kinematics/acceleration/background";
import { measureRocketMotionBounds } from "@repo/design-system/components/contents/physics/kinematics/acceleration/bounds";
import type {
  AccelerationCaseId,
  AccelerationMotionState,
} from "@repo/design-system/components/contents/physics/kinematics/acceleration/data";
import {
  ACCELERATION_LAB_SCENE,
  ACCELERATION_ROCKET_MODEL_PATH,
  ACCELERATION_ROCKET_MOTION,
  getAccelerationLoopTime,
  getAccelerationPositionSample,
} from "@repo/design-system/components/contents/physics/kinematics/acceleration/data";
import { RocketShip } from "@repo/design-system/components/contents/physics/kinematics/acceleration/rocket";
import { useSimulationClock } from "@repo/design-system/components/contents/simulation/clock";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { getColor } from "@repo/design-system/lib/color";
import { Array as Arr, Effect, Option } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

const GATE_PYLON_ANGLES = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2] as const;

/** The time gates and the rocket share one stationary, finite reference frame. */
export function SpaceFlightScene({
  motion,
}: {
  motion: AccelerationMotionState;
}) {
  const { scene } = useGLTF(ACCELERATION_ROCKET_MODEL_PATH);
  const bounds = useMemo(
    () =>
      Effect.runSync(
        measureRocketMotionBounds(scene, motion, {
          ...ACCELERATION_ROCKET_MOTION,
          scale: ACCELERATION_LAB_SCENE.rocketScale,
        })
      ),
    [scene, motion]
  );
  const rocketRef = useRef<Group>(null);
  const { advance, time: simTime } = useSimulationClock(0);
  const caseRef = useRef<AccelerationCaseId>(motion.scenario.id);

  useFrame((_, delta) => {
    if (!rocketRef.current) {
      return;
    }
    if (caseRef.current !== motion.scenario.id) {
      caseRef.current = motion.scenario.id;
      simTime.current = 0;
    }
    const elapsed = advance(delta);
    const time = getAccelerationLoopTime(motion, elapsed);
    const sample = getAccelerationPositionSample(
      motion.scenario,
      time,
      motion.startX
    );
    rocketRef.current.position.x = sample.x;
    rocketRef.current.rotation.y =
      (motion.acceleration < 0 ? Math.PI : 0) +
      Math.sin(elapsed * ACCELERATION_ROCKET_MOTION.yawFrequency) *
        ACCELERATION_ROCKET_MOTION.yawAmplitude;
    rocketRef.current.rotation.z =
      motion.acceleration * ACCELERATION_ROCKET_MOTION.rollPerAcceleration +
      Math.sin(elapsed * ACCELERATION_ROCKET_MOTION.rollFrequency) *
        ACCELERATION_ROCKET_MOTION.rollAmplitude;
  });

  return (
    <>
      <SpaceBackground>
        <StarField length={motion.sceneLength} />
        <SpaceRocks length={motion.sceneLength} />
        <SpeedParticles length={motion.sceneLength} />
      </SpaceBackground>
      <TimeGates motion={motion} />
      <CameraBounds bounds={bounds}>
        <group ref={rocketRef}>
          <group scale={ACCELERATION_LAB_SCENE.rocketScale}>
            <RocketShip
              flameDirection={motion.acceleration === 0 ? undefined : -1}
            />
          </group>
        </group>
      </CameraBounds>
    </>
  );
}

function TimeGates({ motion }: { motion: AccelerationMotionState }) {
  const firstX = Option.match(Arr.head(motion.samples), {
    onNone: () => motion.startX,
    onSome: (sample) => sample.x,
  });
  const lastX = Option.match(Arr.last(motion.samples), {
    onNone: () => motion.startX + motion.worldDisplacement,
    onSome: (sample) => sample.x,
  });
  const radius = ACCELERATION_LAB_SCENE.gateRadius;

  return (
    <group>
      <Line
        color={motion.scenario.color}
        dashed
        dashSize={0.18}
        gapSize={0.14}
        lineWidth={1.6}
        opacity={0.42}
        points={[
          [firstX, -radius - 0.14, 0],
          [lastX, -radius - 0.14, 0],
        ]}
        transparent
      />
      {Arr.map(motion.samples, (sample) => (
        <group key={sample.time} position={[sample.x, 0, 0]}>
          {/* Brushed titanium outer beacon frame */}
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[radius + 0.03, 0.022, 16, 64]} />
            <MetalMaterial color={getColor("SLATE", 300)} roughness={0.3} />
          </mesh>
          {/* Luminous inner timing ring */}
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[radius - 0.006, 0.014, 14, 64]} />
            <meshStandardMaterial
              color={motion.scenario.color}
              emissive={motion.scenario.color}
              emissiveIntensity={1.6}
              roughness={0.2}
            />
          </mesh>
          {/* Radial sensor pods around each timing gate */}
          {Arr.map(GATE_PYLON_ANGLES, (angle) => (
            <mesh
              key={angle}
              position={[
                0,
                Math.cos(angle) * (radius + 0.048),
                Math.sin(angle) * (radius + 0.048),
              ]}
              rotation={[angle, 0, 0]}
            >
              <cylinderGeometry args={[0.02, 0.026, 0.075, 12]} />
              <MetalMaterial color={getColor("SLATE", 400)} roughness={0.26} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}
