"use client";

import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useCameraFraming } from "@repo/design-system/components/three/camera/framing";
import {
  resolveThreeFontSize,
  type ThreeFontSize,
} from "@repo/design-system/components/three/data/constants";
import {
  type ComponentProps,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { Color, type Group, OrthographicCamera } from "three";

type HtmlProps = ComponentProps<typeof Html>;
type LabelAnchorX = "center" | "left" | "right";
type LabelAnchorY = "bottom" | "middle" | "top";

interface ThreeLabelProps {
  anchorX?: LabelAnchorX;
  anchorY?: LabelAnchorY;
  children: ReactNode;
  color: string | Color;
  fontSize?: ThreeFontSize | number;
  /** Enables scene-aware depth occlusion for labels attached to geometry. */
  occlude?: HtmlProps["occlude"];
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
    return 0;
  }

  if (anchor === "right" || anchor === "bottom") {
    return -1;
  }

  return -0.5;
}

function anchorOrigin(anchor: LabelAnchorX | LabelAnchorY) {
  return anchor === "middle" ? "center" : anchor;
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
  occlude,
  position,
  rotation = 0,
  visible = true,
}: ThreeLabelProps) {
  const framing = useCameraFraming();
  const group = useRef<Group>(null);
  const camera = useThree((state) => state.camera);
  const canvasHeight = useThree((state) => state.size.height);
  const invalidate = useThree((state) => state.invalidate);
  const labelColor = color instanceof Color ? color.getStyle() : color;
  const worldFontSize = resolveThreeFontSize(fontSize);
  const distanceFactor =
    (worldFontSize *
      (camera instanceof OrthographicCamera ? 1 : canvasHeight)) /
    LABEL_BASE_FONT_SIZE;
  const outlineWidthEm = worldFontSize > 0 ? outlineWidth / worldFontSize : 0;

  // Drei mounts Html through a separate React root, so demand-mode canvases
  // need one frame after each label render to apply its final world matrix.
  useEffect(() => {
    if (position === undefined) {
      return;
    }
    invalidate();
    framing?.invalidate();
  }, [framing, invalidate, position]);

  const measureLabel = useCallback(
    (element: HTMLDivElement | null) => {
      const object = group.current;
      if (!(element && object && framing)) {
        return;
      }
      const measure = () => {
        framing.labels.set(object, {
          anchorX: anchorOffset(anchorX),
          anchorY: anchorOffset(anchorY),
          height: (element.offsetHeight * worldFontSize) / LABEL_BASE_FONT_SIZE,
          rotation,
          width: (element.offsetWidth * worldFontSize) / LABEL_BASE_FONT_SIZE,
        });
        framing.invalidate();
      };
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      measure();
      return () => {
        observer.disconnect();
        framing.labels.delete(object);
        framing.invalidate();
      };
    },
    [anchorX, anchorY, framing, rotation, worldFontSize]
  );

  if (!visible) {
    return null;
  }

  return (
    <group position={position} ref={group}>
      <Html
        distanceFactor={distanceFactor}
        occlude={occlude}
        ref={measureLabel}
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
          transform: `translate(${anchorOffset(anchorX) * 100}%, ${anchorOffset(anchorY) * 100}%) rotate(${rotation}rad)`,
          transformOrigin: `${anchorOrigin(anchorX)} ${anchorOrigin(anchorY)}`,
          userSelect: "none",
          whiteSpace: "nowrap",
        }}
        zIndexRange={LABEL_Z_INDEX_RANGE}
      >
        <span aria-hidden="true">{children}</span>
      </Html>
    </group>
  );
}
