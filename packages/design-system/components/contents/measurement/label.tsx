import { Billboard, Text } from "@react-three/drei";

import {
  MONO_FONT_PATH,
  resolveThreeFontSize,
  type ThreeFontSize,
} from "@repo/design-system/components/three/_data";

type SceneLabelPosition = readonly [number, number, number];

/**
 * Renders camera-facing text so labels remain readable after the scene rotates.
 */
export function SceneLabel({
  alwaysOnTop = false,
  children,
  color,
  fontSize = "annotation",
  position,
}: {
  alwaysOnTop?: boolean;
  children: string;
  color: string;
  fontSize?: ThreeFontSize | number;
  position: SceneLabelPosition;
}) {
  const resolvedFontSize = resolveThreeFontSize(fontSize);

  return (
    <Billboard position={position}>
      <Text
        anchorX="center"
        anchorY="middle"
        color={color}
        font={MONO_FONT_PATH}
        fontSize={resolvedFontSize}
        renderOrder={alwaysOnTop ? 10 : undefined}
      >
        {children}
        {alwaysOnTop && (
          <meshBasicMaterial
            color={color}
            depthTest={false}
            toneMapped={false}
          />
        )}
      </Text>
    </Billboard>
  );
}
