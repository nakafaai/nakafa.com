import { useFrame, useThree } from "@react-three/fiber";
import type { IsomerCompound } from "@repo/design-system/components/contents/chemistry/isomer/model";
import { evaluateIsomerGeometry } from "@repo/design-system/components/contents/chemistry/isomer/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { ORGANIC_COLORS } from "@repo/design-system/lib/material/organic";
import { Array as Arr } from "effect";
import { useRef } from "react";
import type { Group } from "three";

function IsomerCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.5, 3.35] : [0, 1.28, 2.7]}
      cameraTarget={[0, 0.62, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

export function AlkaneAlkeneScene({
  compound,
  parts,
}: {
  readonly compound: IsomerCompound;
  readonly parts: Readonly<
    Record<
      | "bromineDrop"
      | "carbonAtom"
      | "doubleBond"
      | "hydrogenAtom"
      | "singleBond",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const molRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const geom = evaluateIsomerGeometry(compound);

  useFrame((_, delta) => {
    if (!playing || molRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 0.7;
    molRef.current.rotation.y = Math.sin(phaseRef.current) * 0.3;
  });

  const doubleX = geom.doubleBondIndex === 0 ? -0.44 : 0;
  const doubleY = geom.doubleBondIndex === 0 ? 0.62 : 0.68;

  return (
    <group>
      <SimulationTicker running={playing} />
      <IsomerCamera />
      <group ref={molRef}>
        {Arr.map(geom.carbons, (atom) => (
          <group key={atom.id} position={[atom.x, atom.y, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.13, 16, 14]} />
              <meshStandardMaterial
                color={ORGANIC_COLORS.carbonDark}
                roughness={0.35}
              />
            </mesh>
            <mesh position={[0, 0.2, 0.08]}>
              <sphereGeometry args={[0.068, 12, 10]} />
              <meshStandardMaterial color={ORGANIC_COLORS.hydrogenWhite} />
            </mesh>
            <mesh position={[0, -0.2, -0.06]}>
              <sphereGeometry args={[0.068, 12, 10]} />
              <meshStandardMaterial color={ORGANIC_COLORS.hydrogenWhite} />
            </mesh>
          </group>
        ))}
        {/* C=C double bond highlight bars for alkenes */}
        {geom.unsaturated ? (
          <group position={[doubleX, doubleY, 0]}>
            <mesh position={[0, 0.045, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.028, 0.028, 0.42, 10]} />
              <meshStandardMaterial color={ORGANIC_COLORS.doubleBondGold} />
            </mesh>
            <mesh position={[0, -0.045, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.028, 0.028, 0.42, 10]} />
              <meshStandardMaterial color={ORGANIC_COLORS.doubleBondGold} />
            </mesh>
          </group>
        ) : (
          <mesh position={[0, 0.62, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.028, 0.028, 0.92, 10]} />
            <meshStandardMaterial color={ORGANIC_COLORS.fabricSlate} />
          </mesh>
        )}
      </group>
      {/* Bromine water indicator drop beside molecule */}
      <mesh castShadow position={[0.92, 0.3, 0]}>
        <sphereGeometry args={[0.14, 16, 14]} />
        <meshStandardMaterial
          color={
            geom.unsaturated
              ? ORGANIC_COLORS.condenserGlass
              : ORGANIC_COLORS.bromineBrown
          }
          opacity={geom.unsaturated ? 0.35 : 0.88}
          transparent
        />
      </mesh>
      {/* Labels */}
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[-0.78, 1.02, 0]}
      >
        <span>{parts.carbonAtom}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[0.78, 1.06, 0]}
      >
        <span>{parts.hydrogenAtom}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[0, 0.24, 0.2]}
      >
        <span>{geom.unsaturated ? parts.doubleBond : parts.singleBond}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[0.95, 0.56, 0]}
      >
        <span>{parts.bromineDrop}</span>
      </ThreeLabel>
    </group>
  );
}
