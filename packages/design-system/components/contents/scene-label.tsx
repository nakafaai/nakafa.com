import { Billboard, Text } from "@react-three/drei";

import {
  MONO_FONT_PATH,
  resolveThreeFontSize,
  type ThreeFontSize,
} from "@repo/design-system/components/three/data/constants";
import { Suspense } from "react";

type SceneLabelPosition = readonly [number, number, number];

/**
 * Renders camera-facing text so labels remain readable after the scene rotates.
 */
export function SceneLabel({
  children,
  color,
  fontSize = "annotation",
  position,
}: {
  children: string;
  color: string;
  fontSize?: ThreeFontSize | number;
  position: SceneLabelPosition;
}) {
  const resolvedFontSize = resolveThreeFontSize(fontSize);

  return (
    <Billboard position={position}>
      <Suspense fallback={null}>
        <Text
          anchorX="center"
          anchorY="middle"
          color={color}
          font={MONO_FONT_PATH}
          fontSize={resolvedFontSize}
          raycast={() => null}
        >
          {children}
        </Text>
      </Suspense>
    </Billboard>
  );
}
