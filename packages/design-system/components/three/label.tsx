"use client";

import { Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useCameraFraming } from "@repo/design-system/components/three/camera/framing";
import {
  resolveThreeFontSize,
  THREE_DIAGRAM_MAXIMUM_FONT_SIZE,
  THREE_DIAGRAM_MINIMUM_FONT_SIZE,
  type ThreeFontSize,
} from "@repo/design-system/components/three/data/constants";
import {
  type ComponentProps,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  Color,
  type Group,
  MathUtils,
  OrthographicCamera,
  Vector3,
} from "three";

type HtmlProps = ComponentProps<typeof Html>;
type LabelAnchorX = "center" | "left" | "right";
type LabelAnchorY = "bottom" | "middle" | "top";

interface ThreeLabelProps {
  anchorX?: LabelAnchorX;
  anchorY?: LabelAnchorY;
  children: ReactNode;
  color: string | Color;
  fontSize?: ThreeFontSize | number;
  /** Separation from the anchor in camera-facing world units. */
  gap?: number;
  /** Upper rendered size keeps annotations subordinate to their geometry. */
  maximumFontSize?: number;
  /** Minimum rendered font size in CSS pixels, independent of the world scale. */
  minimumFontSize?: number;
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

function gapDirection(anchor: LabelAnchorX | LabelAnchorY) {
  if (anchor === "left" || anchor === "top") {
    return 1;
  }
  if (anchor === "right" || anchor === "bottom") {
    return -1;
  }
  return 0;
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
  gap = 0,
  minimumFontSize = typeof fontSize === "number"
    ? 0
    : THREE_DIAGRAM_MINIMUM_FONT_SIZE,
  maximumFontSize = minimumFontSize > 0
    ? THREE_DIAGRAM_MAXIMUM_FONT_SIZE
    : Number.POSITIVE_INFINITY,
  outlineColor,
  outlineWidth = 0,
  occlude,
  position,
  rotation = 0,
  visible = true,
}: ThreeLabelProps) {
  const framing = useCameraFraming();
  const group = useRef<Group>(null);
  const content = useRef<HTMLSpanElement>(null);
  const labelPosition = useMemo(() => new Vector3(), []);
  const cameraPosition = useMemo(() => new Vector3(), []);
  const camera = useThree((state) => state.camera);
  const canvasHeight = useThree((state) => state.size.height);
  const invalidate = useThree((state) => state.invalidate);
  const labelColor = color instanceof Color ? color.getStyle() : color;
  const worldFontSize = resolveThreeFontSize(fontSize);
  const distanceFactor =
    (worldFontSize *
      (camera instanceof OrthographicCamera ? 1 : canvasHeight)) /
    LABEL_BASE_FONT_SIZE;
  const gapPixels =
    worldFontSize > 0 ? (gap * LABEL_BASE_FONT_SIZE) / worldFontSize : 0;
  const outlineWidthEm = worldFontSize > 0 ? outlineWidth / worldFontSize : 0;

  // Display scaling never changes the natural dimensions observed for fitting.
  useFrame(({ camera: activeCamera, size }) => {
    const element = content.current;
    const object = group.current;
    if (!(element && object)) {
      return;
    }
    if (worldFontSize <= 0) {
      element.style.scale = "1";
      return;
    }
    object.getWorldPosition(labelPosition);
    activeCamera.getWorldPosition(cameraPosition);
    const pixelsPerUnit =
      activeCamera instanceof OrthographicCamera
        ? activeCamera.zoom
        : size.height /
          (2 *
            Math.tan(MathUtils.degToRad(activeCamera.fov) / 2) *
            labelPosition.distanceTo(cameraPosition));
    const naturalSize = worldFontSize * pixelsPerUnit;
    element.style.scale = `${
      MathUtils.clamp(naturalSize, minimumFontSize, maximumFontSize) /
      naturalSize
    }`;
  });

  // Position changes must also update the camera's label bounds.
  useEffect(() => {
    if (position === undefined) {
      return;
    }
    invalidate();
    framing?.invalidate();
  }, [framing, invalidate, position]);

  const measureLabel = useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) {
        return;
      }
      // Html commits through a separate React root after this component.
      // Wake the canvas once its content can be scaled and projected.
      invalidate();
      const object = group.current;
      if (!(object && framing)) {
        return;
      }
      const measure = () => {
        const width =
          (element.offsetWidth * worldFontSize) / LABEL_BASE_FONT_SIZE;
        const height =
          (element.offsetHeight * worldFontSize) / LABEL_BASE_FONT_SIZE;
        framing.labels.set(object, {
          anchorX: anchorOffset(anchorX),
          anchorY: anchorOffset(anchorY),
          gap: {
            x: gapDirection(anchorX) * gap,
            y: gapDirection(anchorY) * gap,
          },
          height,
          pixels: minimumFontSize
            ? {
                width:
                  (element.offsetWidth * minimumFontSize) /
                  LABEL_BASE_FONT_SIZE,
                height:
                  (element.offsetHeight * minimumFontSize) /
                  LABEL_BASE_FONT_SIZE,
              }
            : undefined,
          rotation,
          width,
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
    [
      anchorX,
      anchorY,
      framing,
      gap,
      invalidate,
      minimumFontSize,
      rotation,
      worldFontSize,
    ]
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
          fontFamily: "var(--font-sans)",
          fontSize: LABEL_BASE_FONT_SIZE,
          lineHeight: 1,
          paintOrder: "stroke fill",
          pointerEvents: "none",
          transform: `translate(${anchorOffset(anchorX) * 100}%, ${anchorOffset(anchorY) * 100}%) rotate(${rotation}rad) translate(${gapDirection(anchorX) * gapPixels}px, ${gapDirection(anchorY) * gapPixels}px)`,
          transformOrigin: `${anchorOrigin(anchorX)} ${anchorOrigin(anchorY)}`,
          userSelect: "none",
          whiteSpace: "nowrap",
        }}
        zIndexRange={LABEL_Z_INDEX_RANGE}
      >
        <span
          aria-hidden="true"
          ref={content}
          style={{
            display: "inline-block",
            transformOrigin: `${anchorOrigin(anchorX)} ${anchorOrigin(anchorY)}`,
            verticalAlign: "top",
          }}
        >
          {children}
        </span>
      </Html>
    </group>
  );
}
