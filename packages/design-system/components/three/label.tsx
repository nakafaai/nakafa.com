"use client";

import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import {
  resolveThreeFontSize,
  type ThreeFontSize,
} from "@repo/design-system/components/three/data/constants";
import type { ComponentProps, ReactNode } from "react";
import { Color } from "three";

type HtmlProps = ComponentProps<typeof Html>;
type LabelAnchorX = "center" | "left" | "right";
type LabelAnchorY = "bottom" | "middle" | "top";

interface ThreeLabelProps {
  anchorX?: LabelAnchorX;
  anchorY?: LabelAnchorY;
  children: ReactNode;
  color: string | Color;
  fontSize?: ThreeFontSize | number;
  outlineColor?: string;
  outlineWidth?: number;
  position: HtmlProps["position"];
  /** Screen-plane rotation in radians. */
  rotation?: number;
  visible?: boolean;
}

const LABEL_BASE_FONT_SIZE = 16;
const LABEL_Z_INDEX_RANGE: [number, number] = [1, 0];

function anchorOffset(anchor: LabelAnchorX | LabelAnchorY) {
  if (anchor === "left" || anchor === "top") {
    return "0%";
  }

  if (anchor === "right" || anchor === "bottom") {
    return "-100%";
  }

  return "-50%";
}

/**
 * Renders semantic React content at one camera-facing Three.js world position.
 *
 * A plain string and rich content such as mixed prose and KaTeX use the same
 * authoring contract. The bounded portal layer stays below scene controls and
 * does not intercept pointer input. Visual labels stay hidden from assistive
 * technology because each scene owns its complete accessible description.
 *
 * @see https://drei.docs.pmnd.rs/misc/html
 */
export function ThreeLabel({
  anchorX = "center",
  anchorY = "middle",
  children,
  color,
  fontSize = "annotation",
  outlineColor,
  outlineWidth = 0,
  position,
  rotation = 0,
  visible = true,
}: ThreeLabelProps) {
  const canvasHeight = useThree((state) => state.size.height);
  const labelColor = color instanceof Color ? color.getStyle() : color;
  const worldFontSize = resolveThreeFontSize(fontSize);
  const distanceFactor = (worldFontSize * canvasHeight) / LABEL_BASE_FONT_SIZE;
  const outlineWidthEm = worldFontSize > 0 ? outlineWidth / worldFontSize : 0;

  if (!visible) {
    return null;
  }

  return (
    <Html
      aria-hidden="true"
      distanceFactor={distanceFactor}
      position={position}
      style={{
        WebkitTextStroke:
          outlineColor && outlineWidthEm > 0
            ? `${outlineWidthEm}em ${outlineColor}`
            : undefined,
        color: labelColor,
        fontFamily: "var(--font-mono)",
        fontSize: LABEL_BASE_FONT_SIZE,
        lineHeight: 1,
        paintOrder: "stroke fill",
        pointerEvents: "none",
        transform: `translate(${anchorOffset(anchorX)}, ${anchorOffset(anchorY)}) rotate(${rotation}rad)`,
        transformOrigin: "center",
        userSelect: "none",
        whiteSpace: "nowrap",
      }}
      zIndexRange={LABEL_Z_INDEX_RANGE}
    >
      {children}
    </Html>
  );
}
