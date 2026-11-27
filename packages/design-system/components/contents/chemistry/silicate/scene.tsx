import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import {
  AmorphousGlassNetwork,
  LayeredClaySheets,
  MacroMaterialSpecimen,
  RIG_Z,
  SinteredCeramicGrains,
  STAGE_X,
} from "@repo/design-system/components/contents/chemistry/silicate/apparatus";
import type { SilicateMaterial } from "@repo/design-system/components/contents/chemistry/silicate/model";
import { evaluateSilicateLattice } from "@repo/design-system/components/contents/chemistry/silicate/model";
import { SpecimenPlinth } from "@repo/design-system/components/contents/chemistry/specimen";
import { useSimulationClock } from "@repo/design-system/components/contents/simulation/clock";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { useRef } from "react";
import type { Group } from "three";

function SilicateCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [-0.03, 0.35, 1.18] : [-0.03, 0.28, 0.88]}
      cameraTarget={[-0.03, 0.13, 0.03]}
      fov={37}
      maxDistance={2.2}
      minDistance={0.38}
    />
  );
}

export function GlassCeramicScene({
  material,
  parts,
}: {
  readonly material: SilicateMaterial;
  readonly parts: Readonly<
    Record<
      "boronNode" | "clayLayer" | "crystalGrain" | "silicaTetrahedron",
      string
    >
  >;
}) {
  const labelInk = useLabelInk();
  const latticeRef = useRef<Group>(null);
  const { advance, playing } = useSimulationClock(0);
  const profile = evaluateSilicateLattice(material);

  useFrame((_, delta) => {
    const t = advance(delta);
    if (latticeRef.current !== null) {
      latticeRef.current.rotation.y = Math.sin(t * 0.65) * 0.38;
    }
  });

  const primaryLabel = profile.isAmorphous
    ? parts.silicaTetrahedron
    : parts.clayLayer;

  // Plain soda-lime glass has one thing to name, so its lattice carries no second label.
  let secondaryLabel: string | null = parts.crystalGrain;
  if (profile.hasBoron) {
    secondaryLabel = parts.boronNode;
  } else if (profile.isAmorphous) {
    secondaryLabel = null;
  }

  return (
    <group>
      <SimulationTicker running={playing} />
      <SilicateCamera />
      <LabBench width={2.6} />

      {/* Left: real macroscopic specimen on brass coaster */}
      <MacroMaterialSpecimen material={material} />

      {/* Right: elevated microstructure turntable plinth */}
      <group position={[STAGE_X, 0, RIG_Z]}>
        <SpecimenPlinth depth={0.21} height={0.014} width={0.32} />
        <mesh position={[0, 0.029, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.088, 0.0026, 12, 56]} />
          <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.26} />
        </mesh>

        <group position={[0, 0.132, 0]} ref={latticeRef}>
          {profile.isAmorphous ? (
            <AmorphousGlassNetwork hasBoron={profile.hasBoron} />
          ) : null}
          {profile.isAmorphous || profile.orderedCrystals ? null : (
            <LayeredClaySheets />
          )}
          {profile.orderedCrystals ? <SinteredCeramicGrains /> : null}
        </group>
      </group>

      {/* Non-overlapping adaptive labels */}
      <ThreeLabel
        color={labelInk}
        fontSize="compact"
        maximumFontSize={14}
        position={[STAGE_X - 0.085, 0.048, RIG_Z + 0.118]}
      >
        <span>{primaryLabel}</span>
      </ThreeLabel>
      {secondaryLabel === null ? null : (
        <ThreeLabel
          color={labelInk}
          fontSize="compact"
          maximumFontSize={14}
          position={[STAGE_X + 0.03, 0.242, RIG_Z]}
        >
          <span>{secondaryLabel}</span>
        </ThreeLabel>
      )}
    </group>
  );
}
