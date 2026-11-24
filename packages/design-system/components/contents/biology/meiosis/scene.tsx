import { useFrame, useThree } from "@react-three/fiber";
import type { MeiosisStage } from "@repo/design-system/components/contents/biology/meiosis/model";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { GENETICS_COLORS } from "@repo/design-system/lib/material/genetics";
import { Array as Arr, Match } from "effect";
import { useMemo, useRef } from "react";
import type { Group } from "three";

function MeiosisCamera() {
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

export function MeiosisShufflingScene({
  chromosomePairs,
  parts,
  stage,
}: {
  readonly chromosomePairs: number;
  readonly parts: Readonly<
    Record<
      | "centromere"
      | "chiasma"
      | "gamete"
      | "maternalChromatid"
      | "paternalChromatid",
      string
    >
  >;
  readonly stage: MeiosisStage;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const groupRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  const displayPairs = Math.min(4, Math.max(1, Math.round(chromosomePairs)));
  const pairIndices = useMemo(
    () => Arr.makeBy(displayPairs, (index) => index),
    [displayPairs]
  );

  useFrame((_, delta) => {
    if (!playing || groupRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 1.1;
    groupRef.current.rotation.y = Math.sin(phaseRef.current) * 0.25;
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <MeiosisCamera />
      <group ref={groupRef}>
        {stage === "crossingOver" ? (
          <group position={[0, 0.62, 0]}>
            {/* Maternal homologue (left) */}
            <mesh castShadow position={[-0.18, 0, 0]} rotation={[0, 0, -0.18]}>
              <capsuleGeometry args={[0.055, 0.62, 8, 12]} />
              <meshStandardMaterial color={GENETICS_COLORS.maternalRose} />
            </mesh>
            {/* Paternal homologue (right) crossing at chiasma */}
            <mesh castShadow position={[0.18, 0, 0]} rotation={[0, 0, 0.18]}>
              <capsuleGeometry args={[0.055, 0.62, 8, 12]} />
              <meshStandardMaterial color={GENETICS_COLORS.paternalBlue} />
            </mesh>
            {/* Recombinant swapped tips */}
            <mesh position={[-0.08, -0.34, 0.02]}>
              <sphereGeometry args={[0.06, 12, 10]} />
              <meshStandardMaterial color={GENETICS_COLORS.paternalBlue} />
            </mesh>
            <mesh position={[0.08, -0.34, 0.02]}>
              <sphereGeometry args={[0.06, 12, 10]} />
              <meshStandardMaterial color={GENETICS_COLORS.maternalRose} />
            </mesh>
            {/* Chiasma overlap point */}
            <mesh position={[0, -0.18, 0.06]}>
              <sphereGeometry args={[0.072, 14, 12]} />
              <meshStandardMaterial
                color={GENETICS_COLORS.chiasmaGlow}
                emissive={GENETICS_COLORS.chiasmaGlow}
                emissiveIntensity={0.35}
              />
            </mesh>
            {/* Centromeres */}
            <mesh position={[-0.22, 0.14, 0.04]}>
              <sphereGeometry args={[0.065, 12, 10]} />
              <meshStandardMaterial color={GENETICS_COLORS.centromereGold} />
            </mesh>
            <mesh position={[0.22, 0.14, 0.04]}>
              <sphereGeometry args={[0.065, 12, 10]} />
              <meshStandardMaterial color={GENETICS_COLORS.centromereGold} />
            </mesh>
          </group>
        ) : null}

        {stage === "independentAssortment" ? (
          <group>
            {Arr.map(pairIndices, (index) => {
              const x = -0.6 + (index / Math.max(1, displayPairs - 1)) * 1.2;
              const flipped = index % 2 === 1;
              return (
                <group
                  key={`pair-${index}`}
                  position={[displayPairs === 1 ? 0 : x, 0.62, 0]}
                >
                  <mesh position={[0, 0.2, 0]}>
                    <capsuleGeometry args={[0.05, 0.24, 6, 10]} />
                    <meshStandardMaterial
                      color={
                        flipped
                          ? GENETICS_COLORS.paternalBlue
                          : GENETICS_COLORS.maternalRose
                      }
                    />
                  </mesh>
                  <mesh position={[0, -0.2, 0]}>
                    <capsuleGeometry args={[0.05, 0.24, 6, 10]} />
                    <meshStandardMaterial
                      color={
                        flipped
                          ? GENETICS_COLORS.maternalRose
                          : GENETICS_COLORS.paternalBlue
                      }
                    />
                  </mesh>
                </group>
              );
            })}
          </group>
        ) : null}

        {stage === "randomFertilisation" ? (
          <group position={[0, 0.62, 0]}>
            <mesh castShadow position={[-0.42, 0, 0]}>
              <sphereGeometry args={[0.2, 16, 14]} />
              <meshStandardMaterial
                color={GENETICS_COLORS.maternalRose}
                opacity={0.82}
                transparent
              />
            </mesh>
            <mesh castShadow position={[0.42, 0, 0]}>
              <sphereGeometry args={[0.14, 14, 12]} />
              <meshStandardMaterial color={GENETICS_COLORS.paternalBlue} />
            </mesh>
            <mesh position={[0, 0, 0]}>
              <sphereGeometry args={[0.12, 14, 12]} />
              <meshStandardMaterial color={GENETICS_COLORS.gameteCyan} />
            </mesh>
          </group>
        ) : null}
      </group>

      {/* Labels */}
      <ThreeLabel
        color={GENETICS_COLORS.labelInk}
        fontSize="compact"
        position={[-0.82, 0.94, 0]}
      >
        <span>{parts.maternalChromatid}</span>
      </ThreeLabel>
      <ThreeLabel
        color={GENETICS_COLORS.labelInk}
        fontSize="compact"
        position={[0.82, 0.94, 0]}
      >
        <span>{parts.paternalChromatid}</span>
      </ThreeLabel>
      <ThreeLabel
        color={GENETICS_COLORS.labelInk}
        fontSize="compact"
        position={[0, 0.2, 0.28]}
      >
        <span>
          {Match.value(stage).pipe(
            Match.when("crossingOver", () => parts.chiasma),
            Match.when("randomFertilisation", () => parts.gamete),
            Match.when("independentAssortment", () => parts.centromere),
            Match.exhaustive
          )}
        </span>
      </ThreeLabel>
    </group>
  );
}
