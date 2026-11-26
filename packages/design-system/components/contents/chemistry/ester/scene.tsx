import { useFrame, useThree } from "@react-three/fiber";
import type { EsterId } from "@repo/design-system/components/contents/chemistry/ester/model";
import { evaluateEsterReflux } from "@repo/design-system/components/contents/chemistry/ester/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { ORGANIC_COLORS } from "@repo/design-system/lib/material/organic";
import { useRef } from "react";
import type { Group } from "three";

function EsterCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.65, 3.45] : [0, 1.4, 2.8]}
      cameraTarget={[0, 0.72, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

export function EsterificationRefluxScene({
  ester,
  parts,
  temperatureC,
}: {
  readonly ester: EsterId;
  readonly parts: Readonly<
    Record<
      "catalystDrop" | "condenser" | "esterLayer" | "roundFlask" | "waterBath",
      string
    >
  >;
  readonly temperatureC: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const vaporRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const reading = evaluateEsterReflux(ester, temperatureC);

  useFrame((_, delta) => {
    if (!playing || vaporRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * (reading.refluxing ? 1.8 : 0.6);
    const t = phaseRef.current % 1;
    vaporRef.current.position.set(0, 0.56 + Math.sin(t * Math.PI) * 0.52, 0);
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <EsterCamera />
      {/* Warm water bath */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[0.48, 0.44, 0.36, 22]} />
        <meshStandardMaterial
          color={ORGANIC_COLORS.waterBlue}
          opacity={0.48}
          transparent
        />
      </mesh>
      {/* Round-bottom flask */}
      <mesh position={[0, 0.44, 0]}>
        <sphereGeometry args={[0.28, 18, 16]} />
        <meshStandardMaterial
          color={ORGANIC_COLORS.condenserGlass}
          opacity={0.34}
          transparent
        />
      </mesh>
      {/* Floating sweet-smelling ester layer */}
      <mesh position={[0, 0.44, 0]}>
        <cylinderGeometry
          args={[0.23, 0.2, 0.06 + reading.esterLayerRatio * 0.14, 18]}
        />
        <meshStandardMaterial
          color={ORGANIC_COLORS.esterRose}
          roughness={0.3}
        />
      </mesh>
      {/* Vertical Liebig reflux condenser */}
      <mesh position={[0, 0.96, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.62, 16, 1, true]} />
        <meshStandardMaterial
          color={ORGANIC_COLORS.alkaliCyan}
          opacity={0.36}
          side={2}
          transparent
        />
      </mesh>
      <mesh position={[0, 0.96, 0]}>
        <cylinderGeometry args={[0.048, 0.048, 0.68, 12]} />
        <meshStandardMaterial
          color={ORGANIC_COLORS.condenserGlass}
          opacity={0.45}
          transparent
        />
      </mesh>
      {/* Condensing ester droplet */}
      <group position={[0, 0.85, 0]} ref={vaporRef}>
        <mesh>
          <sphereGeometry args={[0.042, 10, 10]} />
          <meshStandardMaterial color={ORGANIC_COLORS.esterRose} />
        </mesh>
      </group>
      {/* Sulfuric acid catalyst indicator */}
      <mesh position={[0.12, 0.38, 0.14]}>
        <sphereGeometry args={[0.04, 10, 10]} />
        <meshStandardMaterial color={ORGANIC_COLORS.doubleBondGold} />
      </mesh>
      {/* Labels */}
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[0.64, 1.02, 0]}
      >
        <span>{parts.condenser}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[-0.72, 0.56, 0]}
      >
        <span>{parts.roundFlask}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[0.68, 0.52, 0]}
      >
        <span>{parts.esterLayer}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[-0.76, 0.2, 0]}
      >
        <span>{parts.waterBath}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[0.68, 0.24, 0.2]}
      >
        <span>{parts.catalystDrop}</span>
      </ThreeLabel>
    </group>
  );
}
