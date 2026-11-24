import { useFrame, useThree } from "@react-three/fiber";
import type {
  JointKind,
  JointPart,
} from "@repo/design-system/components/contents/biology/joint/model";
import { jointAnglesAt } from "@repo/design-system/components/contents/biology/joint/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { SKELETON_COLORS } from "@repo/design-system/lib/material/skeleton";
import { useRef } from "react";
import type { Group } from "three";

function JointCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.55, 3.65] : [0, 1.25, 2.85]}
      cameraTarget={[0, 0.45, 0]}
      fov={38}
      maxDistance={6}
      minDistance={1.4}
    />
  );
}

export function JointScene({
  joint,
  motion,
  onMotionChange,
  parts,
}: {
  readonly joint: JointKind;
  readonly motion: number;
  readonly onMotionChange: (next: number) => void;
  readonly parts: Readonly<Record<JointPart, string>>;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const movingRef = useRef<Group>(null);
  const clock = useRef(0);

  useFrame((_, delta) => {
    const dt = simulationStep(delta);
    let current = motion;
    if (playing) {
      clock.current += dt;
      current = 0.5 + 0.5 * Math.sin(clock.current * 1.8);
      if (Math.abs(current - motion) > 0.04) {
        onMotionChange(Math.round(current * 100) / 100);
      }
    }
    const group = movingRef.current;
    if (group === null) {
      return;
    }
    const angles = jointAnglesAt(joint, current);
    group.rotation.set(angles.pitchRad, angles.yawRad, angles.rollRad);
  });

  if (joint === "suture") {
    return (
      <group>
        <SimulationTicker running={playing} />
        <JointCamera />
        <mesh castShadow position={[-0.32, 0.55, 0]}>
          <sphereGeometry args={[0.42, 20, 14, 0, Math.PI]} />
          <meshStandardMaterial color={SKELETON_COLORS.bone} roughness={0.62} />
        </mesh>
        <mesh castShadow position={[0.32, 0.55, 0]} rotation={[0, Math.PI, 0]}>
          <sphereGeometry args={[0.42, 20, 14, 0, Math.PI]} />
          <meshStandardMaterial color={SKELETON_COLORS.bone} roughness={0.62} />
        </mesh>
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[0.04, 0.56, 0.42]} />
          <meshStandardMaterial
            color={SKELETON_COLORS.ligament}
            roughness={0.78}
          />
        </mesh>
        <ThreeLabel
          color={SKELETON_COLORS.labelInk}
          fontSize="compact"
          position={[-0.45, 1.05, 0]}
        >
          <span>{parts.bone}</span>
        </ThreeLabel>
      </group>
    );
  }

  if (joint === "disc") {
    return (
      <group>
        <SimulationTicker running={playing} />
        <JointCamera />
        <mesh castShadow position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.34, 0.36, 0.28, 22]} />
          <meshStandardMaterial color={SKELETON_COLORS.bone} roughness={0.58} />
        </mesh>
        <mesh position={[0, 0.46, 0]}>
          <cylinderGeometry args={[0.32, 0.32, 0.14, 22]} />
          <meshStandardMaterial
            color={SKELETON_COLORS.cartilage}
            roughness={0.42}
          />
        </mesh>
        <group position={[0, 0.53, 0]} ref={movingRef}>
          <mesh castShadow position={[0, 0.18, 0]}>
            <cylinderGeometry args={[0.34, 0.34, 0.28, 22]} />
            <meshStandardMaterial
              color={SKELETON_COLORS.bone}
              roughness={0.58}
            />
          </mesh>
        </group>
        <ThreeLabel
          color={SKELETON_COLORS.labelInk}
          fontSize="compact"
          position={[-0.55, 0.72, 0]}
        >
          <span>{parts.bone}</span>
        </ThreeLabel>
        <ThreeLabel
          color={SKELETON_COLORS.labelInk}
          fontSize="compact"
          position={[0.58, 0.46, 0]}
        >
          <span>{parts.cartilage}</span>
        </ThreeLabel>
      </group>
    );
  }

  return (
    <group>
      <SimulationTicker running={playing} />
      <JointCamera />
      {/* Proximal fixed bone */}
      <mesh
        castShadow
        position={[-0.52, 0.55, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <capsuleGeometry args={[0.11, 0.72, 10, 16]} />
        <meshStandardMaterial color={SKELETON_COLORS.bone} roughness={0.55} />
      </mesh>
      {/* Cartilage cap + synovial cavity */}
      <mesh position={[-0.08, 0.55, 0]}>
        <sphereGeometry args={[0.16, 18, 14]} />
        <meshStandardMaterial
          color={SKELETON_COLORS.cartilage}
          roughness={0.38}
        />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.24, 20, 16]} />
        <meshPhysicalMaterial
          color={SKELETON_COLORS.synovialFluid}
          opacity={0.32}
          roughness={0.14}
          transparent
        />
      </mesh>
      <mesh position={[0, 0.55, 0]}>
        <torusGeometry args={[0.24, 0.025, 10, 24]} />
        <meshStandardMaterial
          color={SKELETON_COLORS.membraneHealthy}
          roughness={0.48}
        />
      </mesh>
      {/* Ligament */}
      <mesh position={[0, 0.34, 0.14]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.026, 0.026, 0.46, 10]} />
        <meshStandardMaterial
          color={SKELETON_COLORS.ligament}
          roughness={0.68}
        />
      </mesh>
      {/* Muscle + tendon pulling across the joint */}
      <mesh
        castShadow
        position={[-0.42, 0.76, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <capsuleGeometry args={[0.085, 0.44, 10, 14]} />
        <meshStandardMaterial
          color={SKELETON_COLORS.muscleContract}
          roughness={0.58}
        />
      </mesh>
      <mesh position={[-0.02, 0.72, 0]} rotation={[0, 0, -0.22]}>
        <boxGeometry args={[0.38, 0.036, 0.05]} />
        <meshStandardMaterial color={SKELETON_COLORS.tendon} roughness={0.5} />
      </mesh>
      {/* Moving distal bone */}
      <group position={[0, 0.55, 0]} ref={movingRef}>
        <mesh castShadow position={[0.48, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.1, 0.68, 10, 16]} />
          <meshStandardMaterial color={SKELETON_COLORS.bone} roughness={0.55} />
        </mesh>
      </group>

      <ThreeLabel
        color={SKELETON_COLORS.labelInk}
        fontSize="compact"
        position={[-0.72, 0.36, 0]}
      >
        <span>{parts.bone}</span>
      </ThreeLabel>
      <ThreeLabel
        color={SKELETON_COLORS.labelInk}
        fontSize="compact"
        position={[-0.12, 0.2, 0.24]}
      >
        <span>{parts.cartilage}</span>
      </ThreeLabel>
      <ThreeLabel
        color={SKELETON_COLORS.labelInk}
        fontSize="compact"
        position={[0.18, 0.94, 0]}
      >
        <span>{parts.membrane}</span>
      </ThreeLabel>
      <ThreeLabel
        color={SKELETON_COLORS.labelInk}
        fontSize="compact"
        position={[0.22, 0.76, 0.22]}
      >
        <span>{parts.fluid}</span>
      </ThreeLabel>
      <ThreeLabel
        color={SKELETON_COLORS.labelInk}
        fontSize="compact"
        position={[0.15, 0.12, 0.14]}
      >
        <span>{parts.ligament}</span>
      </ThreeLabel>
      <ThreeLabel
        color={SKELETON_COLORS.labelInk}
        fontSize="compact"
        position={[-0.02, 0.94, 0.1]}
      >
        <span>{parts.tendon}</span>
      </ThreeLabel>
      <ThreeLabel
        color={SKELETON_COLORS.labelInk}
        fontSize="compact"
        position={[-0.55, 0.98, 0]}
      >
        <span>{parts.muscle}</span>
      </ThreeLabel>
    </group>
  );
}
