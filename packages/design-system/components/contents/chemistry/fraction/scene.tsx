import { useFrame, useThree } from "@react-three/fiber";
import type { PetroleumFraction } from "@repo/design-system/components/contents/chemistry/fraction/model";
import { evaluatePetroleumFraction } from "@repo/design-system/components/contents/chemistry/fraction/model";
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

const ALL_FRACTIONS: readonly PetroleumFraction[] = [
  "refineryGas",
  "petrol",
  "kerosene",
  "diesel",
  "bitumen",
];

function FractionCamera() {
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.25
  );
  return (
    <CameraControls
      cameraPosition={narrow ? [0, 1.55, 3.45] : [0, 1.32, 2.8]}
      cameraTarget={[0, 0.66, 0]}
      fov={38}
      maxDistance={5.8}
      minDistance={1.4}
    />
  );
}

function fractionHex(fraction: PetroleumFraction): string {
  return Match.value(fraction).pipe(
    Match.when("refineryGas", () => ORGANIC_COLORS.refineryCyan),
    Match.when("petrol", () => ORGANIC_COLORS.petrolYellow),
    Match.when("kerosene", () => ORGANIC_COLORS.keroseneOrange),
    Match.when("diesel", () => ORGANIC_COLORS.dieselAmber),
    Match.when("bitumen", () => ORGANIC_COLORS.bitumenBlack),
    Match.exhaustive
  );
}

export function FractionalDistillationScene({
  fraction,
  parts,
}: {
  readonly fraction: PetroleumFraction;
  readonly parts: Readonly<
    Record<
      "bubbleCap" | "column" | "furnace" | "outletPipe" | "vaporStream",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const vaporRef = useRef<Group>(null);
  const phaseRef = useRef(0);
  const selected = evaluatePetroleumFraction(fraction);

  useFrame((_, delta) => {
    if (!playing || vaporRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 1.1;
    const t = phaseRef.current % 1;
    vaporRef.current.position.set(0, 0.22 + t * (selected.trayY - 0.16), 0.16);
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <FractionCamera />
      {/* Pre-heating crude oil furnace on left */}
      <mesh castShadow position={[-0.78, 0.24, 0]}>
        <boxGeometry args={[0.42, 0.36, 0.4]} />
        <meshStandardMaterial
          color={ORGANIC_COLORS.furnaceRed}
          roughness={0.6}
        />
      </mesh>
      <mesh position={[-0.4, 0.26, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.048, 0.048, 0.42, 12]} />
        <meshStandardMaterial color={ORGANIC_COLORS.carbonDark} />
      </mesh>
      {/* Tall fractionating tower */}
      <mesh position={[0, 0.66, 0]}>
        <cylinderGeometry args={[0.28, 0.3, 1.14, 22, 1, true]} />
        <meshStandardMaterial
          color={ORGANIC_COLORS.condenserGlass}
          opacity={0.34}
          side={2}
          transparent
        />
      </mesh>
      {/* Horizontal bubble-cap trays + side outlet pipes */}
      {Arr.map(ALL_FRACTIONS, (id) => {
        const level = evaluatePetroleumFraction(id);
        const active = id === fraction;
        return (
          <group key={id} position={[0, level.trayY, 0]}>
            <mesh>
              <cylinderGeometry args={[0.26, 0.26, 0.036, 20]} />
              <meshStandardMaterial
                color={fractionHex(id)}
                opacity={active ? 1 : 0.42}
                transparent={!active}
              />
            </mesh>
            <mesh position={[0.42, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry
                args={[
                  active ? 0.044 : 0.026,
                  active ? 0.044 : 0.026,
                  0.34,
                  10,
                ]}
              />
              <meshStandardMaterial color={fractionHex(id)} />
            </mesh>
          </group>
        );
      })}
      {/* Rising hydrocarbon vapour bead */}
      <group position={[0, 0.56, 0.16]} ref={vaporRef}>
        <mesh>
          <sphereGeometry args={[0.048, 12, 10]} />
          <meshStandardMaterial color={fractionHex(fraction)} />
        </mesh>
      </group>
      {/* Labels */}
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[-0.84, 0.54, 0]}
      >
        <span>{parts.furnace}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[0, 1.32, 0]}
      >
        <span>{parts.column}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[-0.72, 0.88, 0]}
      >
        <span>{parts.bubbleCap}</span>
      </ThreeLabel>
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[0.88, selected.trayY, 0]}
      >
        <span>
          {parts.outletPipe} ({selected.chainLength})
        </span>
      </ThreeLabel>
      <ThreeLabel
        color={ORGANIC_COLORS.labelInk}
        fontSize="compact"
        position={[0.72, 0.14, 0.28]}
      >
        <span>{parts.vaporStream}</span>
      </ThreeLabel>
    </group>
  );
}
