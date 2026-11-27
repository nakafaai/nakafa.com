import { useFrame, useThree } from "@react-three/fiber";
import {
  CholesterolMolecule,
  PhospholipidBilayer,
  WaterMolecules,
} from "@repo/design-system/components/contents/biology/bilayer";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import {
  GlycanChain,
  TransmembraneChannel,
} from "@repo/design-system/components/contents/biology/membrane";
import type { MembraneComponent } from "@repo/design-system/components/contents/biology/mosaic/model";
import { evaluateMembraneFluidity } from "@repo/design-system/components/contents/biology/mosaic/model";
import { SpecimenPedestal } from "@repo/design-system/components/contents/biology/workbench";
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
import { HOMEOSTASIS_COLORS } from "@repo/design-system/lib/material/homeostasis";
import { useRef } from "react";
import type { Group } from "three";

const PROTEIN_CUTOUT = [{ radius: 0.28, x: 0, z: 0 }] as const;

const AQUEOUS_WATER: readonly (readonly [number, number, number])[] = [
  [-0.96, 1.06, 0.14],
  [-0.44, 1.12, -0.18],
  [0.64, 1.08, 0.22],
  [1.04, 1.02, -0.1],
  [-0.86, 0.18, 0.18],
  [-0.24, 0.16, -0.14],
  [0.54, 0.18, 0.2],
  [0.98, 0.2, -0.12],
];

function MosaicCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.66, 3.85] : [0, 1.38, 3.28]}
      cameraTarget={[0, 0.62, 0]}
      fov={38}
      maxDistance={6.2}
      minDistance={1.4}
    />
  );
}

export function FluidMosaicScene({
  component,
  parts,
  temperatureC,
}: {
  readonly component: MembraneComponent;
  readonly parts: Readonly<
    Record<
      | "cholesterol"
      | "glycolipid"
      | "glycoprotein"
      | "hydrophilicHead"
      | "hydrophobicTail"
      | "integralProtein",
      string
    >
  >;
  readonly temperatureC: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const invalidate = useThree((state) => state.invalidate);
  const ink = useLabelInk();
  const bilayerRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const fluidity = evaluateMembraneFluidity(temperatureC);

  const rewind = () => {
    phaseRef.current = 0;
    if (bilayerRef.current !== null) {
      bilayerRef.current.position.set(0, 0, 0);
    }
    invalidate();
  };

  useVisualStop(rewind);
  useVisualReset(rewind);

  useFrame((_, delta) => {
    if (!playing || bilayerRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * fluidity.lateralWaveSpeed;
    bilayerRef.current.position.x =
      Math.sin(phaseRef.current) * fluidity.lateralWaveAmplitude;
    bilayerRef.current.position.y =
      Math.cos(phaseRef.current * 1.4) * fluidity.lateralWaveAmplitude * 0.35;
  });

  const focusOpacity = (target: MembraneComponent) =>
    component === target ? 1 : 0.42;

  return (
    <group>
      <SimulationTicker running={playing} />
      <MosaicCamera />
      <SpecimenPedestal depth={0.94} height={0.055} width={2.48} />

      <group ref={bilayerRef}>
        {/* High-detail 3D multi-row amphipathic phospholipid bilayer */}
        <PhospholipidBilayer
          cols={11}
          cutouts={PROTEIN_CUTOUT}
          opacity={focusOpacity("phospholipid")}
          rows={3}
          spacingX={0.21}
          spacingZ={0.2}
          yCenter={0.62}
        />

        {/* Planar 4-ring cholesterol molecules tucked between hydrophobic tails */}
        <CholesterolMolecule
          opacity={focusOpacity("cholesterol")}
          position={[-0.52, 0.65, 0.24]}
          rotation={[0.08, 0.25, 0.06]}
        />
        <CholesterolMolecule
          opacity={focusOpacity("cholesterol")}
          position={[0.54, 0.6, 0.22]}
          rotation={[-0.06, -0.32, -0.05]}
        />
        <CholesterolMolecule
          opacity={focusOpacity("cholesterol")}
          position={[-0.78, 0.59, -0.12]}
          rotation={[0.05, 0.18, -0.08]}
        />

        {/* Sculpted 6-helix transmembrane integral channel protein */}
        <TransmembraneChannel
          accentColor={HOMEOSTASIS_COLORS.helixBeta}
          color={HOMEOSTASIS_COLORS.helixAlpha}
          height={0.62}
          opacity={focusOpacity("integralProtein")}
          position={[0, 0.62, 0]}
          radius={0.165}
        />

        {/* Branched glycoprotein oligosaccharide chain on integral protein */}
        <GlycanChain
          branched
          color={HOMEOSTASIS_COLORS.glycanHex}
          opacity={focusOpacity("glycoprotein")}
          position={[0.06, 0.94, 0.04]}
        />

        {/* Glycolipid carbohydrate antenna anchored to an outer phospholipid head */}
        <GlycanChain
          branched={false}
          color={HOMEOSTASIS_COLORS.glycanBranch}
          opacity={focusOpacity("glycoprotein")}
          position={[-0.84, 0.88, 0.12]}
        />

        {/* Surrounding aqueous water molecules */}
        <WaterMolecules positions={AQUEOUS_WATER} />
      </group>

      {/* Non-overlapping adaptive-ink labels */}
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        position={[-0.86, 1.18, 0.12]}
      >
        <span>{parts.glycolipid}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        position={[0.16, 1.28, 0.05]}
      >
        <span>{parts.glycoprotein}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        position={[0.88, 1.0, 0.12]}
      >
        <span>{parts.hydrophilicHead}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorY="top"
        color={ink}
        fontSize="compact"
        position={[0.88, 0.24, 0.28]}
      >
        <span>{parts.hydrophobicTail}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorY="top"
        color={ink}
        fontSize="compact"
        position={[-0.66, 0.24, 0.34]}
      >
        <span>{parts.cholesterol}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorY="top"
        color={ink}
        fontSize="compact"
        position={[0.04, 0.18, 0.36]}
      >
        <span>{parts.integralProtein}</span>
      </ThreeLabel>
    </group>
  );
}
