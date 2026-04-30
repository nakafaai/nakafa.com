import { Text } from "@react-three/drei";
import type { MeasurementSceneProps } from "@repo/design-system/components/contents/physics/measurement/tools/data";
import {
  METAL_COLOR,
  STOPWATCH_HAND_CENTER,
  STOPWATCH_HAND_LENGTH,
  STOPWATCH_SECONDS_PER_ROTATION,
  TIME_COLOR,
  TIME_FACE_COLOR,
  TIME_SCENE_SCALE,
} from "@repo/design-system/components/contents/physics/measurement/tools/data";
import {
  MONO_FONT_PATH,
  THREE_FONT_SIZE,
} from "@repo/design-system/components/three/data/constants";
import { useMemo } from "react";

/**
 * Renders a stopwatch with a hand angle derived from elapsed seconds.
 */
export function TimeScene({
  colors,
  measurement,
  reading,
}: MeasurementSceneProps) {
  const handAngle =
    (measurement / STOPWATCH_SECONDS_PER_ROTATION) * Math.PI * 2;
  const tickMarks = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const angle = (index / 12) * Math.PI * 2;

        return {
          id: `clock-${index}`,
          rotation: -angle,
          x: Math.sin(angle) * 1.05,
          y: Math.cos(angle) * 1.05,
        };
      }),
    []
  );

  return (
    <group
      position={[0, 0.35, 0]}
      rotation={[0.05, -0.25, 0]}
      scale={TIME_SCENE_SCALE}
    >
      <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.35, 1.35, 0.22, 80]} />
        <meshStandardMaterial color={TIME_COLOR} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0, 0.14]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.08, 1.08, 0.04, 80]} />
        <meshStandardMaterial color={TIME_FACE_COLOR} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.45, 0]}>
        <boxGeometry args={[0.46, 0.28, 0.24]} />
        <meshStandardMaterial color={METAL_COLOR} metalness={0.25} />
      </mesh>

      {tickMarks.map((tick) => (
        <mesh
          key={tick.id}
          position={[tick.x, tick.y, 0.2]}
          rotation={[0, 0, tick.rotation]}
        >
          <boxGeometry args={[0.04, 0.18, 0.04]} />
          <meshStandardMaterial color={colors.text} />
        </mesh>
      ))}

      <mesh
        position={[
          Math.sin(handAngle) * STOPWATCH_HAND_CENTER,
          Math.cos(handAngle) * STOPWATCH_HAND_CENTER,
          0.22,
        ]}
        rotation={[0, 0, -handAngle]}
      >
        <boxGeometry args={[0.06, STOPWATCH_HAND_LENGTH, 0.04]} />
        <meshStandardMaterial color={TIME_COLOR} />
      </mesh>
      <mesh position={[0, 0, 0.25]}>
        <sphereGeometry args={[0.09, 32, 32]} />
        <meshStandardMaterial color={TIME_COLOR} />
      </mesh>
      <Text
        anchorX="center"
        color={colors.text}
        font={MONO_FONT_PATH}
        fontSize={THREE_FONT_SIZE.display}
        position={[0, -0.55, 0.25]}
      >
        {reading}
      </Text>
    </group>
  );
}
