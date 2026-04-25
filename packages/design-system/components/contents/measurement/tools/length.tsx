import { RoundedBox } from "@react-three/drei";
import { useMemo } from "react";

import { SceneLabel } from "../label";
import type { MeasurementSceneProps } from "./data";
import {
  OBJECT_COLOR,
  RULER_COLOR,
  RULER_LENGTH_CM,
  RULER_MAJOR_TICK_COUNT,
  RULER_MINOR_TICK_COUNT,
  RULER_START_X,
  RULER_STEP_CM,
} from "./data";

/**
 * Renders a ruler with an object whose length matches the selected reading.
 */
export function LengthScene({
  colors,
  measurement,
  reading,
}: MeasurementSceneProps) {
  const blockCenterX = RULER_START_X + measurement / 2;
  const blockEndX = RULER_START_X + measurement;
  const readingLabelX = Math.max(blockEndX + 0.35, RULER_START_X + 0.95);
  const majorTicks = useMemo(
    () =>
      Array.from({ length: RULER_MAJOR_TICK_COUNT }, (_, index) => ({
        id: `major-${index}`,
        x: RULER_START_X + index,
      })),
    []
  );
  const minorTicks = useMemo(
    () =>
      Array.from({ length: RULER_MINOR_TICK_COUNT }, (_, index) => ({
        id: `minor-${index}`,
        x: RULER_START_X + index * RULER_STEP_CM,
      })),
    []
  );

  return (
    <group rotation={[-0.2, 0.05, 0]}>
      <RoundedBox
        args={[RULER_LENGTH_CM + 0.6, 0.18, 1]}
        radius={0.05}
        smoothness={3}
      >
        <meshStandardMaterial color={RULER_COLOR} roughness={0.65} />
      </RoundedBox>

      {minorTicks.map((tick) => (
        <mesh key={tick.id} position={[tick.x, 0.13, -0.34]}>
          <boxGeometry args={[0.025, 0.14, 0.04]} />
          <meshStandardMaterial color={colors.text} />
        </mesh>
      ))}

      {majorTicks.map((tick) => (
        <mesh key={tick.id} position={[tick.x, 0.15, -0.27]}>
          <boxGeometry args={[0.04, 0.22, 0.06]} />
          <meshStandardMaterial color={colors.text} />
        </mesh>
      ))}

      <RoundedBox
        args={[measurement, 0.42, 0.42]}
        position={[blockCenterX, 0.42, 0.52]}
      >
        <meshStandardMaterial color={OBJECT_COLOR} roughness={0.5} />
      </RoundedBox>

      <SceneLabel
        color={colors.text}
        fontSize={0.24}
        position={[RULER_START_X - 0.35, 0.64, 1]}
      >
        0
      </SceneLabel>
      <SceneLabel
        color={colors.text}
        fontSize={0.24}
        position={[readingLabelX, 0.92, 1]}
      >
        {reading}
      </SceneLabel>
    </group>
  );
}
