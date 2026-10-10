"use client";

import { type ThreeElements, useFrame, useThree } from "@react-three/fiber";
import { useCameraFraming } from "@repo/design-system/components/three/camera/framing";
import {
  resolveThreeFontSize,
  THREE_DIAGRAM_MAXIMUM_FONT_SIZE,
  THREE_DIAGRAM_MINIMUM_FONT_SIZE,
  type ThreeFontSize,
} from "@repo/design-system/components/three/data/constants";
import { SceneHtml } from "@repo/design-system/components/three/overlay";
import { MutableHashMap } from "effect";
import { type ReactNode, useCallback, useEffect, useMemo, useRef } from "react";
import {
  Color,
  type Group,
  MathUtils,
  OrthographicCamera,
  Vector3,
} from "three";

type LabelAnchorX = "center" | "left" | "right";
type LabelAnchorY = "bottom" | "middle" | "top";

interface ThreeLabelProps {
  anchorX?: LabelAnchorX | undefined;
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
  /** Hides the label while an object of the scene stands between the camera and the label. */
  occlude?: boolean | undefined;
  outlineColor?: string | undefined;
  outlineWidth?: number | undefined;
  position: ThreeElements["group"]["position"];
  /** Screen-plane rotation in radians. */
  rotation?: number;
  visible?: boolean;
}

const LABEL_BASE_FONT_SIZE = 16;

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
 * authoring contract. The content draws in the scene overlay beside the canvas,
 * and the overlay never intercepts pointer input. Visual labels stay hidden from
 * assistive technology because each scene owns its complete accessible description.
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
      // The content mounts in the scene overlay after this callback is attached.
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
        MutableHashMap.set(framing.labels, object.id, {
          anchorX: anchorOffset(anchorX),
          anchorY: anchorOffset(anchorY),
          gap: {
            x: gapDirection(anchorX) * gap,
            y: gapDirection(anchorY) * gap,
          },
          height,
          ...(minimumFontSize
            ? {
                pixels: {
                  width:
                    (element.offsetWidth * minimumFontSize) /
                    LABEL_BASE_FONT_SIZE,
                  height:
                    (element.offsetHeight * minimumFontSize) /
                    LABEL_BASE_FONT_SIZE,
                },
              }
            : {}),
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
        MutableHashMap.remove(framing.labels, object.id);
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
    <group {...(position === undefined ? {} : { position })} ref={group}>
      <SceneHtml
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
      </SceneHtml>
    </group>
  );
}
