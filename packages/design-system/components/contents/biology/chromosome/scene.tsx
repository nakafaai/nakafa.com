import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { MetaphaseChromosome } from "@repo/design-system/components/contents/biology/chromatin";
import type { Level } from "@repo/design-system/components/contents/biology/chromosome/packing";
import {
  DoubleHelixSpecimen,
  FibreSpecimen,
  NucleosomeSpecimen,
  NucleotideSpecimen,
} from "@repo/design-system/components/contents/biology/chromosome/scales";
import { SlideStage } from "@repo/design-system/components/contents/biology/workbench";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import {
  useVisualReset,
  useVisualScene,
  useVisualStop,
} from "@repo/design-system/components/visual/card";
import { Match } from "effect";
import { useRef } from "react";
import type { Group } from "three";

const CAMERA_POSITION: readonly [number, number, number] = [0, 0.86, 2.28];
const CAMERA_TARGET: readonly [number, number, number] = [0, 0.56, 0];

/**
 * 3D hierarchical DNA packaging scene zooming from a single nucleotide to
 * double helix, histone nucleosomes, 30 nm chromatin fibre, and Giemsa-banded
 * metaphase chromosome with sister chromatids joined at the kinetochore.
 */
export function ChromosomeScene({
  level,
  parts,
}: {
  readonly level: Level;
  readonly parts: Readonly<
    Record<
      "phosphate" | "sugar" | "base" | "histone" | "chromatid" | "centromere",
      string
    >
  >;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const invalidate = useThree((state) => state.invalidate);
  const ink = useLabelInk();
  const rootRef = useRef<Group>(null);
  const clock = useRef(0);

  const rewind = () => {
    clock.current = 0;
    if (rootRef.current !== null) {
      rootRef.current.rotation.set(0, 0, 0);
    }
    invalidate();
  };

  useVisualStop(rewind);
  useVisualReset(rewind);

  useFrame((_, delta) => {
    if (!playing || rootRef.current === null) {
      return;
    }
    clock.current += simulationStep(delta);
    rootRef.current.rotation.y = Math.sin(clock.current * 0.72) * 0.45;
  });

  return (
    <group>
      <SimulationTicker running={playing} />
      <CameraControls
        cameraPosition={CAMERA_POSITION}
        cameraTarget={CAMERA_TARGET}
        fov={38}
      />

      <SlideStage position={[0, 0, 0]} radius={0.95} />

      <group ref={rootRef}>
        {Match.value(level).pipe(
          Match.when("nucleotide", () => (
            <NucleotideSpecimen ink={ink} parts={parts} />
          )),
          Match.when("helix", () => (
            <DoubleHelixSpecimen ink={ink} label={parts.base} />
          )),
          Match.when("nucleosome", () => (
            <NucleosomeSpecimen ink={ink} label={parts.histone} />
          )),
          Match.when("fibre", () => (
            <FibreSpecimen ink={ink} label={parts.histone} />
          )),
          Match.when("chromosome", () => (
            <group position={[0, 0.58, 0]}>
              <MetaphaseChromosome
                pLength={0.36}
                qLength={0.46}
                radius={0.09}
                seed={5}
                splay={0.26}
              />
              <ThreeLabel
                anchorX="left"
                color={ink}
                fontSize="compact"
                gap={0.04}
                position={[0.3, 0.34, 0]}
              >
                {parts.chromatid}
              </ThreeLabel>
              <ThreeLabel
                anchorX="left"
                color={ink}
                fontSize="compact"
                gap={0.04}
                position={[0.24, 0, 0]}
              >
                {parts.centromere}
              </ThreeLabel>
            </group>
          )),
          Match.exhaustive
        )}
      </group>
    </group>
  );
}
