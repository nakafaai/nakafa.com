import { useFrame, useThree } from "@react-three/fiber";
import type { AdditionMonomer } from "@repo/design-system/components/contents/chemistry/addition/model";
import { evaluateAdditionChain } from "@repo/design-system/components/contents/chemistry/addition/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { ORGANIC_COLORS } from "@repo/design-system/lib/material/organic";
import { Array as Arr, Match } from "effect";
import { useRef } from "react";
import type { Group } from "three";

function AdditionCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.5, 3.45] : [0, 1.28, 2.8]}
      cameraTarget={[0, 0.58, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

function sideGroupHex(
  kind: "chlorine" | "fluorine" | "hydrogen" | "methyl"
): string {
  return Match.value(kind).pipe(
    Match.when("hydrogen", () => ORGANIC_COLORS.hydrogenWhite),
    Match.when("methyl", () => ORGANIC_COLORS.doubleBondGold),
    Match.when("chlorine", () => ORGANIC_COLORS.chlorineGreen),
    Match.when("fluorine", () => ORGANIC_COLORS.fluorineLime),
    Match.exhaustive
  );
}

export function AdditionPolymerScene({
  chainLength,
  monomer,
  parts,
}: {
  readonly chainLength: number;
  readonly monomer: AdditionMonomer;
  readonly parts: Readonly<
    Record<
      "doubleBond" | "monomerUnit" | "sideGroup" | "singleBackbone",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const chainRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const units = evaluateAdditionChain(monomer, chainLength);

  useFrame((_, delta) => {
    if (!playing || chainRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 0.9;
    chainRef.current.rotation.y = Math.sin(phaseRef.current) * 0.22;
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <AdditionCamera />
      <group ref={chainRef}>
        {/* Continuous saturated C-C polymer backbone */}
        <mesh position={[0, 0.56, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.032, 0.032, 1.95, 12]} />
          <meshStandardMaterial color={ORGANIC_COLORS.fabricSlate} />
        </mesh>
        {/* Linked repeating monomer units */}
        {Arr.map(units, (unit) => (
          <group key={unit.id} position={[unit.x, 0.56, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.1, 14, 12]} />
              <meshStandardMaterial color={ORGANIC_COLORS.carbonDark} />
            </mesh>
            <mesh castShadow position={[0, 0.2, 0]}>
              <sphereGeometry args={[0.078, 12, 10]} />
              <meshStandardMaterial color={sideGroupHex(unit.sideGroupKind)} />
            </mesh>
            <mesh position={[0, -0.18, 0]}>
              <sphereGeometry args={[0.056, 10, 10]} />
              <meshStandardMaterial color={ORGANIC_COLORS.hydrogenWhite} />
            </mesh>
          </group>
        ))}
      </group>
      {/* Incoming free monomer showing C=C double bond above chain */}
      <group position={[0, 1.06, 0]}>
        <mesh position={[-0.14, 0, 0]}>
          <sphereGeometry args={[0.08, 12, 10]} />
          <meshStandardMaterial color={ORGANIC_COLORS.carbonDark} />
        </mesh>
        <mesh position={[0.14, 0, 0]}>
          <sphereGeometry args={[0.08, 12, 10]} />
          <meshStandardMaterial color={ORGANIC_COLORS.carbonDark} />
        </mesh>
        <mesh position={[0, 0.03, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.02, 0.02, 0.28, 8]} />
          <meshStandardMaterial color={ORGANIC_COLORS.doubleBondGold} />
        </mesh>
        <mesh position={[0, -0.03, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.02, 0.02, 0.28, 8]} />
          <meshStandardMaterial color={ORGANIC_COLORS.doubleBondGold} />
        </mesh>
      </group>
      {/* Labels */}
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[-0.78, 1.12, 0]}
      >
        <span>{parts.monomerUnit}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[0.72, 1.12, 0]}
      >
        <span>{parts.doubleBond}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[0.88, 0.84, 0]}
      >
        <span>{parts.sideGroup}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[0, 0.2, 0.2]}
      >
        <span>{parts.singleBackbone}</span>
      </ThreeLabel>
    </group>
  );
}
