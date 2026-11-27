import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type { LiftForce } from "@repo/design-system/components/contents/biology/xylem/model";
import { evaluateXylemLift } from "@repo/design-system/components/contents/biology/xylem/model";
import { XylemVesselCutaway } from "@repo/design-system/components/contents/biology/xylem/vessels";
import { SeamlessBenchSurface } from "@repo/design-system/components/contents/chemistry/surface";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import {
  useVisualReset,
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { BOTANY_COLORS } from "@repo/design-system/lib/material/botany";
import { Array as Arr } from "effect";
import { useCallback, useRef } from "react";
import type { Group } from "three";

const COHESION_BEADS = [0, 0.25, 0.5, 0.75] as const;

function XylemCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.55, 3.4] : [0, 1.35, 2.8]}
      cameraTarget={[0, 0.72, 0]}
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
  const ink = useLabelInk();
  const chainRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const lift = evaluateXylemLift(force, heightMeters);

  const rewind = useCallback(() => {
    phaseRef.current = 0;
  }, []);
  useVisualStop(rewind);
  useVisualReset(rewind);

  const columnRatio = Math.min(
    1,
    lift.maxReachMeters / Math.max(1, heightMeters)
  );
  const columnHeight = 0.24 + columnRatio * 0.74;

  useFrame((_, delta) => {
    if (!playing || chainRef.current === null) {
      return;
    }
    phaseRef.current =
      (phaseRef.current + simulationStep(delta) * lift.flowSpeed * 0.55) % 1;
    Arr.forEach(chainRef.current.children, (child, idx) => {
      const t = (phaseRef.current + (COHESION_BEADS[idx] ?? 0)) % 1;
      child.position.set(0, 0.22 + t * (columnHeight - 0.06), 0.21);
    });
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <XylemCamera />
      <SeamlessBenchSurface radius={14} y={0} />
      <XylemVesselCutaway
        columnHeight={columnHeight}
        reachesTop={lift.reachesTop}
      />

      {/* Rising cohesive H2O droplets linked by glowing hydrogen-bond strands */}
      <group ref={chainRef}>
        {Arr.map(COHESION_BEADS, (offset) => (
          <group
            key={offset}
            position={[0, 0.22 + offset * (columnHeight - 0.06), 0.21]}
          >
            <mesh>
              <sphereGeometry args={[0.036, 14, 12]} />
              <meshPhysicalMaterial
                clearcoat={1}
                color={BOTANY_COLORS.cohesionCyan}
                emissive={BOTANY_COLORS.cohesionCyan}
                emissiveIntensity={0.22}
                roughness={0.12}
              />
            </mesh>
            <mesh position={[0, 0.065, 0]}>
              <cylinderGeometry args={[0.008, 0.008, 0.075, 8]} />
              <meshStandardMaterial
                color={BOTANY_COLORS.vaporMist}
                emissive={BOTANY_COLORS.cohesionCyan}
                emissiveIntensity={0.45}
                opacity={0.75}
                transparent
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* Non-overlapping theme-aware labels */}
      <ThreeLabel
        anchorX="right"
        color={ink}
        fontSize="compact"
        position={[-0.58, 1.38, 0]}
      >
        <span>{parts.stoma}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={ink}
        fontSize="compact"
        position={[0.48, 0.94, 0]}
      >
        <span>{parts.ligninWall}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="right"
        color={ink}
        fontSize="compact"
        position={[-0.48, 0.68, 0.06]}
      >
        <span>{parts.waterColumn}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="left"
        color={ink}
        fontSize="compact"
        position={[0.48, 0.54, 0.14]}
      >
        <span>{parts.cohesionBond}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorX="right"
        color={ink}
        fontSize="compact"
        position={[-0.56, 0.16, 0]}
      >
        <span>{parts.rootCell}</span>
      </ThreeLabel>
    </group>
  );
}
