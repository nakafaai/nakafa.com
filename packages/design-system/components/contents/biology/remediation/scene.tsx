import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import type { RemediationPlant } from "@repo/design-system/components/contents/biology/remediation/model";
import { evaluatePhytoremediation } from "@repo/design-system/components/contents/biology/remediation/model";
import {
  HyperaccumulatorPlant,
  SubstrateCutaway,
} from "@repo/design-system/components/contents/biology/remediation/wetland";
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
import { useCallback, useMemo, useRef } from "react";
import type { Group } from "three";

const METAL_SYMBOLS = ["Pb²⁺", "Cd²⁺", "Zn²⁺"] as const;

function RemediationCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.65, 3.85] : [0, 1.46, 3.35]}
      cameraTarget={[0, 0.54, 0]}
      fov={38}
      maxDistance={6.2}
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
  const ink = useLabelInk();
  const uptakeRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const reading = evaluatePhytoremediation(plant, harvests);

  const rewind = useCallback(() => {
    phaseRef.current = 0;
  }, []);
  useVisualStop(rewind);
  useVisualReset(rewind);

  const visibleIons = Math.max(
    1,
    Math.round((reading.remainingPercent / 100) * 9)
  );
  const ions = useMemo(
    () =>
      Arr.makeBy(9, (index) => ({
        id: `ion-${index}`,
        symbol: METAL_SYMBOLS[index % METAL_SYMBOLS.length] ?? "Pb²⁺",
        x: -0.82 + (index % 5) * 0.41,
        y: 0.14 + (index % 3) * 0.08,
        z: index < 5 ? 0.46 : -0.18,
      })),
    []
  );

  useFrame((_, delta) => {
    if (!playing || uptakeRef.current === null) {
      return;
    }
    phaseRef.current = (phaseRef.current + simulationStep(delta) * 0.85) % 1;
    const t = phaseRef.current;
    uptakeRef.current.position.set(
      Math.sin(t * Math.PI * 2) * 0.08,
      0.22 + t * 0.68,
      0.28
    );
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <RemediationCamera />
      <SubstrateCutaway isAquatic={reading.isAquatic} />
      <HyperaccumulatorPlant plant={plant} />

      {/* Crystalline metallic heavy-metal ions embedded in substrate */}
      {Arr.map(Arr.take(ions, visibleIons), (ion) => (
        <mesh castShadow key={ion.id} position={[ion.x, ion.y, ion.z]}>
          <octahedronGeometry args={[0.044, 0]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.heavyMetal}
            emissive={BOTANY_COLORS.heavyMetalGlint}
            emissiveIntensity={0.18}
            metalness={0.85}
            roughness={0.22}
          />
        </mesh>
      ))}

      {/* Ascending chelated heavy-metal ion moving into shoot */}
      <group position={[0, 0.56, 0.28]} ref={uptakeRef}>
        <mesh castShadow>
          <octahedronGeometry args={[0.046, 0]} />
          <meshStandardMaterial
            color={BOTANY_COLORS.heavyMetalGlint}
            emissive={BOTANY_COLORS.cohesionCyan}
            emissiveIntensity={0.35}
            metalness={0.88}
            roughness={0.18}
          />
        </mesh>
      </group>

      {/* Non-overlapping theme-aware labels kept comfortably inside frame */}
      <ThreeLabel color={ink} fontSize="compact" position={[0.62, 1.12, 0]}>
        <span>{parts.shoot}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.72, 0.56, 0.14]}>
        <span>{parts.rootZone}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[0.68, 0.58, 0.2]}>
        <span>{`${parts.metalIon} (Pb²⁺)`}</span>
      </ThreeLabel>
      <ThreeLabel color={ink} fontSize="compact" position={[-0.78, 0.16, 0.52]}>
        <span>{reading.isAquatic ? parts.waterChannel : parts.soilBed}</span>
      </ThreeLabel>
    </group>
  );
}
