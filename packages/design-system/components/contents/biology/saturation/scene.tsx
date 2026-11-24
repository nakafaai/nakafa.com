import { useFrame, useThree } from "@react-three/fiber";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { ENZYME_COLORS } from "@repo/design-system/lib/material/enzyme";
import { Array as Arr } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

function SaturationCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.9, 3.85] : [0, 1.5, 3.05]}
      cameraTarget={[0, 0.35, 0]}
      fov={38}
      maxDistance={6}
      minDistance={1.5}
    />
  );
}

function particleCoords(index: number, seed: number) {
  const angle = index * 2.399_96 + seed;
  const radius = 0.25 + ((index * 17) % 10) * 0.068;
  const y = 0.16 + ((index * 13) % 9) * 0.085;
  return [Math.cos(angle) * radius, y, Math.sin(angle) * radius] as const;
}

export function SaturationScene({
  busySites,
  enzymeCount,
  parts,
  productCount,
  substrateCount,
}: {
  readonly busySites: number;
  readonly enzymeCount: number;
  readonly parts: Readonly<Record<"enzyme" | "substrate" | "product", string>>;
  readonly productCount: number;
  readonly substrateCount: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const swarmRef = useRef<Group>(null);
  const clock = useRef(0);

  const visibleEnzymes = Math.min(24, enzymeCount);
  const busyVisible = Math.round(
    (busySites / Math.max(1, enzymeCount)) * visibleEnzymes
  );
  const visibleSubstrates = Math.min(48, Math.round(substrateCount / 4));
  const visibleProducts = Math.min(36, Math.round(productCount / 5));

  const enzymeSlots = useMemo(
    () => Arr.makeBy(visibleEnzymes, (i) => particleCoords(i, 0.4)),
    [visibleEnzymes]
  );
  const substrateSlots = useMemo(
    () => Arr.makeBy(visibleSubstrates, (i) => particleCoords(i, 2.1)),
    [visibleSubstrates]
  );
  const productSlots = useMemo(
    () => Arr.makeBy(visibleProducts, (i) => particleCoords(i, 4.3)),
    [visibleProducts]
  );

  useFrame((_, delta) => {
    if (swarmRef.current === null || !playing) {
      return;
    }
    clock.current += simulationStep(delta);
    swarmRef.current.rotation.y = clock.current * 0.32;
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <SaturationCamera />
      <mesh position={[0, 0.48, 0]}>
        <cylinderGeometry args={[1.05, 1.05, 0.96, 36]} />
        <meshPhysicalMaterial
          color={ENZYME_COLORS.vesselGlass}
          opacity={0.22}
          roughness={0.14}
          transparent
        />
      </mesh>
      <group ref={swarmRef}>
        {Arr.map(enzymeSlots, (pos, idx) => (
          <mesh
            castShadow
            key={`e-${pos[0]}-${pos[1]}`}
            position={[pos[0], pos[1], pos[2]]}
          >
            <dodecahedronGeometry args={[0.075, 1]} />
            <meshStandardMaterial
              color={
                idx < busyVisible
                  ? ENZYME_COLORS.enzymeBusy
                  : ENZYME_COLORS.enzymeFree
              }
              roughness={0.46}
            />
          </mesh>
        ))}
        {Arr.map(substrateSlots, (pos) => (
          <mesh
            key={`s-${pos[0]}-${pos[1]}`}
            position={[pos[0], pos[1], pos[2]]}
          >
            <sphereGeometry args={[0.032, 10, 8]} />
            <meshStandardMaterial
              color={ENZYME_COLORS.substrateDot}
              roughness={0.4}
            />
          </mesh>
        ))}
        {Arr.map(productSlots, (pos) => (
          <mesh
            key={`p-${pos[0]}-${pos[1]}`}
            position={[pos[0], pos[1], pos[2]]}
          >
            <octahedronGeometry args={[0.034, 0]} />
            <meshStandardMaterial
              color={ENZYME_COLORS.productDot}
              roughness={0.4}
            />
          </mesh>
        ))}
      </group>
      <ThreeLabel
        color={ENZYME_COLORS.labelInk}
        fontSize="compact"
        position={[-0.95, 0.85, 0.25]}
      >
        <span>{parts.enzyme}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ENZYME_COLORS.labelInk}
        fontSize="compact"
        position={[0.92, 0.72, 0.25]}
      >
        <span>{parts.substrate}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ENZYME_COLORS.labelInk}
        fontSize="compact"
        position={[0.0, 1.04, 0]}
      >
        <span>{parts.product}</span>
      </ThreeLabel>
    </group>
  );
}
