"use client";

import { Billboard, Text } from "@react-three/drei";
import {
  MONO_FONT_PATH,
  resolveThreeFontSize,
  type ThreeFontSize,
} from "@repo/design-system/components/three/data/constants";
import type { ComponentProps, ReactNode } from "react";
import { Color } from "three";

type BillboardProps = ComponentProps<typeof Billboard>;
type TextProps = ComponentProps<typeof Text>;

interface ThreeLabelProps {
  anchorX?: TextProps["anchorX"];
  anchorY?: TextProps["anchorY"];
  children: ReactNode;
  color: string | Color;
  font?: string;
  fontSize?: ThreeFontSize | number;
  material?: TextProps["material"];
  position: BillboardProps["position"];
  renderOrder?: number;
  rotation?: TextProps["rotation"];
  visible?: boolean;
}

/**
 * Shared camera-facing label for interactive Three.js educational scenes.
 */
export function ThreeLabel({
  anchorX = "center",
  anchorY = "middle",
  children,
  color,
  font = MONO_FONT_PATH,
  fontSize = "annotation",
  material,
  position,
  renderOrder = 10,
  rotation,
  visible = true,
}: ThreeLabelProps) {
  const labelColor = color instanceof Color ? color.getStyle() : color;

  return (
    <Billboard position={position} visible={visible}>
      <Text
        anchorX={anchorX}
        anchorY={anchorY}
        color={labelColor}
        font={font}
        fontSize={resolveThreeFontSize(fontSize)}
        frustumCulled={false}
        material={material}
        material-depthTest={false}
        raycast={() => null}
        renderOrder={renderOrder}
        rotation={rotation}
      >
        {children}
      </Text>
    </Billboard>
  );
}
