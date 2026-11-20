import { RoundedBox } from "@react-three/drei";
import {
  RULER_LENGTH_CM,
  RULER_MAJOR_TICK_COUNT,
  RULER_MINOR_TICK_COUNT,
  RULER_START_X,
  RULER_STEP_CM,
} from "@repo/design-system/components/contents/physics/measurement/tools/data";
import type { MeasurementSceneProps } from "@repo/design-system/components/contents/physics/measurement/tools/scene";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import type { Placement } from "@repo/design-system/components/three/repeat";
import { Repeat } from "@repo/design-system/components/three/repeat";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import { CAR_COLORS } from "@repo/design-system/lib/material/car";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr } from "effect";

/** The etched graduations of the rule: one every two millimetres, and a longer one every centimetre. */
const MINOR_TICKS: readonly Placement[] = Arr.makeBy(
  RULER_MINOR_TICK_COUNT,
  (index) => ({
    position: [RULER_START_X + index * RULER_STEP_CM, 0.061, -0.38],
  })
);
const MAJOR_TICKS: readonly Placement[] = Arr.makeBy(
  RULER_MAJOR_TICK_COUNT,
  (index) => ({
    position: [RULER_START_X + index, 0.061, -0.31],
  })
);

/**
 * A stainless steel rule, brushed, with its graduations etched in black along
 * its back edge, tilted toward the reader, and an oak block laid against
 * that edge whose length is the selected reading.
 */
export function LengthScene({
  colors,
  measurement,
  reading,
}: MeasurementSceneProps) {
  const blockCenterX = RULER_START_X + measurement / 2;
  const blockEndX = RULER_START_X + measurement;
  const readingLabelX = Math.max(blockEndX + 0.35, RULER_START_X + 0.95);
  return (
    <group rotation={[0.55, 0.05, 0]}>
      <RoundedBox
        args={[RULER_LENGTH_CM + 0.6, 0.12, 1]}
        castShadow
        radius={0.03}
        receiveShadow
        smoothness={3}
      >
        <SurfaceMaterial
          color={CAR_COLORS.chrome}
          metalness={1}
          repeat={[4, 1]}
          roughness={0.45}
          surface="brushed"
        />
      </RoundedBox>
      <Repeat placements={MINOR_TICKS} shadows={false}>
        <boxGeometry args={[0.018, 0.004, 0.16]} />
        <meshStandardMaterial color={CAR_COLORS.tyre} roughness={0.6} />
      </Repeat>
      <Repeat placements={MAJOR_TICKS} shadows={false}>
        <boxGeometry args={[0.03, 0.004, 0.3]} />
        <meshStandardMaterial color={CAR_COLORS.tyre} roughness={0.6} />
      </Repeat>

      <RoundedBox
        args={[measurement, 0.42, 0.42]}
        castShadow
        position={[blockCenterX, 0.15, -0.72]}
        radius={0.03}
        receiveShadow
        smoothness={3}
      >
        <SurfaceMaterial
          color={INSTRUMENT_COLORS.oak}
          repeat={[2, 1]}
          surface="wood"
        />
      </RoundedBox>

      <ThreeLabel
        color={colors.text}
        fontSize="reading"
        position={[RULER_START_X - 0.35, 0.64, 1]}
      >
        <InlineMath math="0" />
      </ThreeLabel>
      <ThreeLabel
        color={colors.text}
        fontSize="reading"
        position={[readingLabelX, 0.92, 1]}
      >
        {reading}
      </ThreeLabel>
    </group>
  );
}
