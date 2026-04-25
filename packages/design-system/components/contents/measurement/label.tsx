import { Billboard, Text } from "@react-three/drei";

import { MONO_FONT_PATH } from "@repo/design-system/components/three/_data";

type SceneLabelPosition = readonly [number, number, number];

/**
 * Renders camera-facing text so labels remain readable after the scene rotates.
 */
export function SceneLabel({
  children,
  color,
  fontSize,
  position,
}: {
  children: string;
  color: string;
  fontSize: number;
  position: SceneLabelPosition;
}) {
  return (
    <Billboard position={position}>
      <Text
        anchorX="center"
        anchorY="middle"
        color={color}
        font={MONO_FONT_PATH}
        fontSize={fontSize}
      >
        {children}
      </Text>
    </Billboard>
  );
}
