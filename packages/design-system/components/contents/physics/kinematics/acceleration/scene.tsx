"use client";

import { useFrame } from "@react-three/fiber";
import { SpaceBackground } from "@repo/design-system/components/contents/physics/kinematics/acceleration/background";
import {
  ACCELERATION_LAB_SCENE,
  type AccelerationCaseId,
  type AccelerationMotionState,
  getAccelerationLoopTime,
  getAccelerationPositionSample,
} from "@repo/design-system/components/contents/physics/kinematics/acceleration/data";
import { RocketShip } from "@repo/design-system/components/contents/physics/kinematics/acceleration/rocket";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { useRef } from "react";
import type { Group } from "three";

/** The time gates and the rocket share one stationary, finite reference frame. */
export function SpaceFlightScene({
  motion,
}: {
  motion: AccelerationMotionState;
}) {
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
      (motion.acceleration < 0 ? Math.PI : 0) + Math.sin(elapsed * 1.8) * 0.025;
    rocketRef.current.rotation.z =
      motion.acceleration * -0.015 + Math.sin(elapsed * 2.4) * 0.018;
  });

  return (
    <>
      <SpaceBackground length={motion.sceneLength} />
      <TimeGates motion={motion} />
      <CameraBounds
        motion={{
          rotation: "all",
          translation: {
            x: {
              min: motion.startX,
              max: motion.startX + motion.worldDisplacement,
            },
            y: { min: 0, max: 0 },
            z: { min: 0, max: 0 },
          },
        }}
        objectRef={rocketRef}
      >
        <group scale={ACCELERATION_LAB_SCENE.rocketScale}>
          <RocketShip
            flameDirection={motion.acceleration === 0 ? undefined : -1}
          />
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
            args={[ACCELERATION_LAB_SCENE.gateRadius, 0.015, 10, 64]}
          />
          <meshBasicMaterial
            color={motion.scenario.color}
            opacity={0.26}
            transparent
          />
        </mesh>
      ))}
    </group>
  );
}
