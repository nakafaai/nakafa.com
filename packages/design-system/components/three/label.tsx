"use client";

import { Billboard, Html, Text } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
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
  children: null | number | string | undefined;
  color: string | Color;
  font?: string;
  fontSize?: ThreeFontSize | number;
  material?: TextProps["material"];
  position: BillboardProps["position"];
  renderOrder?: number;
  rotation?: TextProps["rotation"];
  visible?: boolean;
}

interface ThreeRichLabelProps {
  children: ReactNode;
  color: string | Color;
  fontSize?: ThreeFontSize | number;
  position: BillboardProps["position"];
  visible?: boolean;
}

const RICH_LABEL_BASE_FONT_SIZE = 16;

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

/**
 * Renders camera-facing React content at one Three.js world position.
 *
 * Use this for labels that need semantic markup, including mixed prose and
 * KaTeX. Plain string labels should keep using ThreeLabel so they remain one
 * efficient WebGL text object instead of creating a DOM root.
 *
 * @see https://drei.docs.pmnd.rs/misc/html
 */
export function ThreeRichLabel({
  children,
  color,
  fontSize = "annotation",
  position,
  visible = true,
}: ThreeRichLabelProps) {
  const canvasHeight = useThree((state) => state.size.height);
  const labelColor = color instanceof Color ? color.getStyle() : color;
  const worldFontSize = resolveThreeFontSize(fontSize);
  const distanceFactor =
    (worldFontSize * canvasHeight) / RICH_LABEL_BASE_FONT_SIZE;

  return (
    <Html
      center
      distanceFactor={distanceFactor}
      pointerEvents="none"
      position={position}
      style={{
        color: labelColor,
        fontSize: RICH_LABEL_BASE_FONT_SIZE,
        lineHeight: 1,
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
      visible={visible}
    >
      {children}
    </Html>
  );
}
