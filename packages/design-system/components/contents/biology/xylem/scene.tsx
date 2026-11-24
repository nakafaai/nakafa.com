import { useFrame, useThree } from "@react-three/fiber";
import type { LiftForce } from "@repo/design-system/components/contents/biology/xylem/model";
import { evaluateXylemLift } from "@repo/design-system/components/contents/biology/xylem/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

function XylemCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.55, 3.3] : [0, 1.35, 2.7]}
      cameraTarget={[0, 0.68, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

export function XylemCohesionScene({
  force,
  heightMeters,
  parts,
}: {
  readonly force: LiftForce;
  readonly heightMeters: number;
  readonly parts: Readonly<
    Record<
      "cohesionBond" | "ligninWall" | "rootCell" | "stoma" | "waterColumn",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const dropletRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const lift = evaluateXylemLift(force, heightMeters);

  const rings = useMemo(
    () =>
      Arr.makeBy(6, (index) => ({
        id: `lr-${index}`,
        y: 0.24 + index * 0.16,
      })),
    []
  );

  const columnRatio = Math.min(
    1,
    lift.maxReachMeters / Math.max(1, heightMeters)
  );
  const columnH = 0.22 + columnRatio * 0.78;

  useFrame((_, delta) => {
    if (!playing || dropletRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * lift.flowSpeed;
    const t = phaseRef.current % 1;
    dropletRef.current.position.set(0, 0.18 + t * columnH, 0.24);
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <XylemCamera />
      {/* Root base cell */}
      <mesh castShadow position={[0, 0.1, 0]}>
        <boxGeometry args={[0.72, 0.18, 0.56]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.epidermisTan}
          roughness={0.7}
        />
      </mesh>
      {/* Hollow lignified xylem vessel */}
      <mesh castShadow position={[0, 0.66, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 1.0, 20, 1, true]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.ligninBrown}
          opacity={0.45}
          roughness={0.55}
          side={2}
          transparent
        />
      </mesh>
      {/* Annular lignin reinforcement rings */}
      {Arr.map(rings, (ring) => (
        <mesh
          key={ring.id}
          position={[0, ring.y, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.21, 0.018, 8, 24]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.ligninBrown}
            roughness={0.5}
          />
        </mesh>
      ))}
      {/* Continuous cohesive water column */}
      <mesh position={[0, 0.18 + columnH * 0.5, 0]}>
        <cylinderGeometry args={[0.14, 0.14, columnH, 16]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.waterBlue}
          opacity={0.78}
          roughness={0.18}
          transparent
        />
      </mesh>
      {/* Leaf canopy with stoma at top */}
      <mesh castShadow position={[0, 1.24, 0]} scale={[1.6, 0.25, 0.9]}>
        <sphereGeometry args={[0.24, 14, 12]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.healthyLeaf}
          roughness={0.5}
        />
      </mesh>
      {/* Ascending cohesive water beads */}
      <group position={[0, 0.55, 0.24]} ref={dropletRef}>
        <mesh>
          <sphereGeometry args={[0.048, 12, 10]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.cohesionCyan}
            roughness={0.2}
          />
        </mesh>
        <mesh position={[0, 0.1, 0]}>
          <sphereGeometry args={[0.042, 12, 10]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.cohesionCyan}
            roughness={0.2}
          />
        </mesh>
      </group>
      {/* Labels */}
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[-0.68, 1.24, 0]}
      >
        <span>{parts.stoma}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[0.64, 0.86, 0]}
      >
        <span>{parts.ligninWall}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[-0.68, 0.62, 0]}
      >
        <span>{parts.waterColumn}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[0.68, 0.5, 0]}
      >
        <span>{parts.cohesionBond}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[-0.66, 0.14, 0]}
      >
        <span>{parts.rootCell}</span>
      </ThreeLabel>
    </group>
  );
}
