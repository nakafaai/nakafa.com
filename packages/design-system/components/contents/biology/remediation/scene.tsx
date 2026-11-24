import { useFrame, useThree } from "@react-three/fiber";
import type { RemediationPlant } from "@repo/design-system/components/contents/biology/remediation/model";
import { evaluatePhytoremediation } from "@repo/design-system/components/contents/biology/remediation/model";
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

function RemediationCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.5, 3.35] : [0, 1.28, 2.7]}
      cameraTarget={[0, 0.56, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

export function PhytoremediationScene({
  harvests,
  parts,
  plant,
}: {
  readonly harvests: number;
  readonly parts: Readonly<
    Record<
      "metalIon" | "rootZone" | "shoot" | "soilBed" | "waterChannel",
      string
    >
  >;
  readonly plant: RemediationPlant;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const uptakeRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const reading = evaluatePhytoremediation(plant, harvests);

  const visibleIons = Math.max(
    1,
    Math.round((reading.remainingPercent / 100) * 8)
  );
  const ions = useMemo(
    () =>
      Arr.makeBy(8, (index) => ({
        id: `ion-${index}`,
        x: -0.78 + (index % 4) * 0.5,
        z: index < 4 ? -0.14 : 0.16,
      })),
    []
  );

  useFrame((_, delta) => {
    if (!playing || uptakeRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 1.1;
    const t = phaseRef.current % 1;
    uptakeRef.current.position.set(0, 0.2 + t * 0.72, 0.24);
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <RemediationCamera />
      {/* Soil bed or aquatic channel */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[2.1, 0.36, 0.85]} />
        <meshStandardMaterial
          color={
            reading.isAquatic ? BOTANY_COLORS.waterBlue : BOTANY_COLORS.soilDark
          }
          opacity={reading.isAquatic ? 0.65 : 1}
          roughness={reading.isAquatic ? 0.2 : 0.85}
          transparent={reading.isAquatic}
        />
      </mesh>
      {/* Heavy metal ions remaining in substrate */}
      {Arr.map(Arr.take(ions, visibleIons), (ion) => (
        <mesh key={ion.id} position={[ion.x, 0.22, ion.z]}>
          <dodecahedronGeometry args={[0.05, 0]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.heavyMetal}
            metalness={0.65}
            roughness={0.3}
          />
        </mesh>
      ))}
      {/* Fibrous hyperaccumulator root zone */}
      <mesh position={[0, 0.3, 0]}>
        <coneGeometry args={[0.3, 0.34, 14]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.rootIvory}
          roughness={0.75}
        />
      </mesh>
      {/* Harvestable shoot canopy */}
      <mesh castShadow position={[0, 0.68, 0]}>
        <cylinderGeometry args={[0.04, 0.055, 0.56, 12]} />
        <meshStandardMaterial
          color={BOTANY_COLORS.stemGreen}
          roughness={0.55}
        />
      </mesh>
      <mesh castShadow position={[0, 0.98, 0]} scale={[1.35, 0.75, 1]}>
        <sphereGeometry args={[0.24, 14, 12]} />
        <meshStandardMaterial
          color={
            plant === "mustard"
              ? BOTANY_COLORS.chlorosisYellow
              : BOTANY_COLORS.healthyLeaf
          }
          roughness={0.48}
        />
      </mesh>
      {/* Ascending chelated metal ion into shoot */}
      <group position={[0, 0.52, 0.24]} ref={uptakeRef}>
        <mesh>
          <dodecahedronGeometry args={[0.048, 0]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.heavyMetal}
            metalness={0.7}
            roughness={0.25}
          />
        </mesh>
      </group>
      {/* Labels */}
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[0.64, 1.02, 0]}
      >
        <span>{parts.shoot}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[-0.72, 0.52, 0]}
      >
        <span>{parts.rootZone}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[0.76, 0.52, 0]}
      >
        <span>{parts.metalIon}</span>
      </ThreeLabel>
      <ThreeLabel
        color={BOTANY_COLORS.labelInk}
        fontSize="compact"
        position={[-0.74, 0.14, 0.48]}
      >
        <span>{reading.isAquatic ? parts.waterChannel : parts.soilBed}</span>
      </ThreeLabel>
    </group>
  );
}
