"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { SpaceBackground } from "@repo/design-system/components/contents/physics/kinematics/acceleration/background";
import { measureRocketMotionBounds } from "@repo/design-system/components/contents/physics/kinematics/acceleration/bounds";
import {
  ACCELERATION_LAB_SCENE,
  ACCELERATION_ROCKET_MODEL_PATH,
  ACCELERATION_ROCKET_MOTION,
  type AccelerationCaseId,
  type AccelerationMotionState,
  getAccelerationLoopTime,
  getAccelerationPositionSample,
} from "@repo/design-system/components/contents/physics/kinematics/acceleration/data";
import { RocketShip } from "@repo/design-system/components/contents/physics/kinematics/acceleration/rocket";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { Effect } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

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
  const startRef = useRef<number | null>(null);
  const caseRef = useRef<AccelerationCaseId | null>(null);

  useFrame((state) => {
    if (!rocketRef.current) {
      return;
    }
    if (startRef.current === null || caseRef.current !== motion.scenario.id) {
      caseRef.current = motion.scenario.id;
      startRef.current = state.clock.elapsedTime;
    }
    const elapsed = state.clock.elapsedTime - startRef.current;
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
      <SpaceBackground length={motion.sceneLength} />
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
  return (
    <group>
      {motion.samples.map((sample) => (
        <mesh
          key={sample.time}
          position={[sample.x, 0, 0]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <torusGeometry
            args={[ACCELERATION_LAB_SCENE.gateRadius, 0.035, 10, 64]}
          />
          <meshBasicMaterial
            color={motion.scenario.color}
            opacity={0.8}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}
