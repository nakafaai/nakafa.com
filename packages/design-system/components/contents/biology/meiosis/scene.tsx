import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { MetaphaseChromosome } from "@repo/design-system/components/contents/biology/chromatin";
import type { MeiosisStage } from "@repo/design-system/components/contents/biology/meiosis/model";
import {
  CrossingOverView,
  FertilisationView,
  SpindleApparatus,
} from "@repo/design-system/components/contents/biology/meiosis/stages";
import { SlideStage } from "@repo/design-system/components/contents/biology/workbench";
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
      cameraPosition={narrow ? [0, 1.56, 3.68] : [0, 1.28, 3.08]}
      cameraTarget={[0, 0.64, 0]}
      fov={38}
      maxDistance={6}
      minDistance={1.4}
    />
  );
}

function AssortmentPair({
  flipped,
  index,
  y,
}: {
  readonly flipped: boolean;
  readonly index: number;
  readonly y: number;
}) {
  const leftPalette = flipped
    ? {
        accent: GENETICS_COLORS.paternalBlue,
        band: GENETICS_COLORS.paternalDark,
        base: GENETICS_COLORS.paternalLight,
      }
    : {
        accent: GENETICS_COLORS.maternalRose,
        band: GENETICS_COLORS.maternalDark,
        base: GENETICS_COLORS.maternalLight,
      };
  const rightPalette = flipped
    ? {
        accent: GENETICS_COLORS.maternalRose,
        band: GENETICS_COLORS.maternalDark,
        base: GENETICS_COLORS.maternalLight,
      }
    : {
        accent: GENETICS_COLORS.paternalBlue,
        band: GENETICS_COLORS.paternalDark,
        base: GENETICS_COLORS.paternalLight,
      };
  return (
    <group position={[0, y, 0]}>
      <MetaphaseChromosome
        accentColor={leftPalette.accent}
        bandColor={leftPalette.band}
        baseColor={leftPalette.base}
        pLength={0.12}
        position={[-0.18, 0, 0]}
        qLength={0.16}
        radius={0.032}
        rotation={[0, 0, Math.PI / 2]}
        seed={index + 2}
        splay={0.22}
      />
      <MetaphaseChromosome
        accentColor={rightPalette.accent}
        bandColor={rightPalette.band}
        baseColor={rightPalette.base}
        pLength={0.12}
        position={[0.18, 0, 0]}
        qLength={0.16}
        radius={0.032}
        rotation={[0, 0, -Math.PI / 2]}
        seed={index + 9}
        splay={0.22}
      />
    </group>
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
  const invalidate = useThree((state) => state.invalidate);
  const ink = useLabelInk();
  const groupRef = useRef<Group>(null);
  const phaseRef = useRef(0);

  const displayPairs = Math.min(4, Math.max(1, Math.round(chromosomePairs)));
  const pairIndices = useMemo(
    () => Arr.makeBy(displayPairs, (index) => index),
    [displayPairs]
  );

  const rewind = () => {
    phaseRef.current = 0;
    if (groupRef.current !== null) {
      groupRef.current.rotation.set(0, 0, 0);
    }
    invalidate();
  };

  useVisualStop(rewind);
  useVisualReset(rewind);

  useFrame((_, delta) => {
    if (!playing || groupRef.current === null) {
      return;
    }
    phaseRef.current += simulationStep(delta) * 0.95;
    groupRef.current.rotation.y = Math.sin(phaseRef.current) * 0.24;
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <MeiosisCamera />
      <SlideStage position={[0, 0, 0]} radius={1.08} />

      <group ref={groupRef}>
        {stage === "crossingOver" ? <CrossingOverView /> : null}

        {stage === "independentAssortment" ? (
          <group>
            <SpindleApparatus position={[0, 0.68, 0]} span={1.72} />
            <mesh position={[0, 0.68, 0]} rotation={[0, Math.PI / 2, 0]}>
              <ringGeometry args={[0.42, 0.44, 48]} />
              <meshBasicMaterial
                color={GENETICS_COLORS.spindleFiber}
                opacity={0.32}
                transparent
              />
            </mesh>
            {Arr.map(pairIndices, (index) => {
              const y =
                displayPairs === 1
                  ? 0.68
                  : 0.34 + (index / (displayPairs - 1)) * 0.68;
              return (
                <AssortmentPair
                  flipped={index % 2 === 1}
                  index={index}
                  key={`pair-${index}`}
                  y={y}
                />
              );
            })}
          </group>
        ) : null}

        {stage === "randomFertilisation" ? <FertilisationView /> : null}
      </group>

      {/* Non-clipping adaptive-ink labels */}
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        position={[-0.64, 1.22, 0]}
      >
        <span>{parts.maternalChromatid}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorY="bottom"
        color={ink}
        fontSize="compact"
        position={[0.64, 1.22, 0]}
      >
        <span>{parts.paternalChromatid}</span>
      </ThreeLabel>
      <ThreeLabel
        anchorY="top"
        color={ink}
        fontSize="compact"
        position={[0, 0.24, 0.34]}
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
