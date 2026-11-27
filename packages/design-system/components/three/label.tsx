import type { ThreeElements } from "@react-three/fiber";
import { useFrame, useThree } from "@react-three/fiber";
import { useCameraFraming } from "@repo/design-system/components/three/camera/framing";
import type { ThreeFontSize } from "@repo/design-system/components/three/data/constants";
import {
  resolveThreeFontSize,
  THREE_DIAGRAM_MAXIMUM_FONT_SIZE,
} from "@repo/design-system/components/three/data/constants";
import type { LabelPixels } from "@repo/design-system/components/three/label/floor";
import { labelRange } from "@repo/design-system/components/three/label/floor";
import type { Rgb } from "@repo/design-system/components/three/label/ink";
import { readableInk } from "@repo/design-system/components/three/label/ink";
import { SceneHtml } from "@repo/design-system/components/three/overlay";
import { useRequired } from "@repo/design-system/hooks/required";
import { getColor } from "@repo/design-system/lib/color";
import { MutableHashMap } from "effect";
import type { ComponentProps, ReactNode } from "react";
import { createContext, useCallback, useEffect, useMemo, useRef } from "react";
import type { Camera, Group, OrthographicCamera } from "three";
import { Color, MathUtils, SRGBColorSpace, Vector3 } from "three";

function isOrthographicCamera(camera: Camera): camera is OrthographicCamera {
  return (
    "isOrthographicCamera" in camera && camera.isOrthographicCamera === true
  );
}

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
  /**
   * Upper rendered size in CSS pixels, which keeps an annotation subordinate to
   * its geometry. It never goes under the label floor (`label/floor.ts`).
   */
  maximumFontSize?: LabelPixels;
  /**
   * Least rendered size in CSS pixels, independent of the world scale. The label
   * floor (`label/floor.ts`) holds when it is left out or smaller.
   */
  minimumFontSize?: LabelPixels;
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
/**
 * The halo every label without an outline of its own draws in the card's color,
 * in em of its font size. Half of it shows outside the glyphs, so an axis, a
 * grid line, or an arrow that passes behind a label stops at the letters
 * instead of striking through them, while the letters stay the larger part.
 */
const LABEL_HALO_EM = 0.18;

/** A 1 by 1 canvas that turns any CSS color the browser knows into its sRGB channels. */
let colorProbe: CanvasRenderingContext2D | null = null;

/** Reads a resolved CSS color, such as `oklch(...)` or `rgb(...)`, as sRGB channels. */
function readRgb(color: string): Rgb {
  if (!colorProbe) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    colorProbe = canvas.getContext("2d", { willReadFrequently: true });
  }
  if (!colorProbe) {
    return [0, 0, 0];
  }
  colorProbe.clearRect(0, 0, 1, 1);
  colorProbe.fillStyle = getColor("BLACK");
  colorProbe.fillStyle = color;
  colorProbe.fillRect(0, 0, 1, 1);
  const [red = 0, green = 0, blue = 0] = colorProbe.getImageData(
    0,
    0,
    1,
    1
  ).data;
  return [red, green, blue];
}

/**
 * Sets the ink of one label's content so its text reaches WCAG AA on what stands
 * right behind it: the label's own outline, or else its halo in the card color of
 * the theme the page shows now, which may be any named theme.
 */
function paintInk(
  content: HTMLElement,
  ink: string,
  outline: string | undefined
) {
  const backing =
    outline ?? getComputedStyle(content).getPropertyValue("--card");
  const [red, green, blue] = readableInk(readRgb(ink), readRgb(backing));
  content.style.color = new Color()
    .setRGB(red / 255, green / 255, blue / 255, SRGBColorSpace)
    .getStyle();
}

/** Calls back whenever the root element changes its theme class or color scheme. */
function watchTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributeFilter: ["class", "style", "data-theme"],
  });
  return () => observer.disconnect();
}

/** What the overlay content of one label draws, which it reads from its label. */
interface LabelValues {
  distanceFactor: number;
  measure: ComponentProps<typeof SceneHtml>["ref"];
  occlude: boolean | undefined;
  style: ComponentProps<typeof SceneHtml>["style"];
}

const LabelContext = createContext<LabelValues | null>(null);

/** Selects the overlay values of the surrounding label. */
function useThreeLabel() {
  return useRequired(LabelContext, "useThreeLabel");
}

/**
 * The overlay content of one label. The label provides what it draws, so the
 * content takes no props.
 */
function LabelHtml({ children }: { children: ReactNode }) {
  const { distanceFactor, measure, occlude, style } = useThreeLabel();

  return (
    <SceneHtml
      distanceFactor={distanceFactor}
      occlude={occlude}
      ref={measure}
      style={style}
    >
      {children}
    </SceneHtml>
  );
}

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
  minimumFontSize,
  maximumFontSize,
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
  const lastScale = useRef(Number.NaN);
  const labelColor = color instanceof Color ? color.getStyle() : color;
  const worldFontSize = resolveThreeFontSize(fontSize);
  const outlineWidthEm = worldFontSize > 0 ? outlineWidth / worldFontSize : 0;
  const outline = outlineColor && outlineWidthEm > 0 ? outlineColor : undefined;
  const attachContent = useCallback(
    (element: HTMLSpanElement | null) => {
      content.current = element;
      lastScale.current = Number.NaN;
      if (element) {
        paintInk(element, labelColor, outline);
      }
    },
    [labelColor, outline]
  );
  // A new theme repaints the ink against the card color it brings.
  useEffect(
    () =>
      watchTheme(() => {
        if (content.current) {
          paintInk(content.current, labelColor, outline);
        }
      }),
    [labelColor, outline]
  );
  const labelPosition = useMemo(() => new Vector3(), []);
  const cameraPosition = useMemo(() => new Vector3(), []);
  const camera = useThree((state) => state.camera);
  const canvasHeight = useThree((state) => state.size.height);
  const canvasWidth = useThree((state) => state.size.width);
  const invalidate = useThree((state) => state.invalidate);
  const { high: largestSize, low: leastSize } = labelRange({
    canvasWidth,
    maximum:
      maximumFontSize ??
      (typeof fontSize === "number" && minimumFontSize === undefined
        ? Number.POSITIVE_INFINITY
        : THREE_DIAGRAM_MAXIMUM_FONT_SIZE),
    minimum: minimumFontSize ?? 0,
  });
  const distanceFactor =
    (worldFontSize * (isOrthographicCamera(camera) ? 1 : canvasHeight)) /
    LABEL_BASE_FONT_SIZE;
  const gapPixels =
    worldFontSize > 0 ? (gap * LABEL_BASE_FONT_SIZE) / worldFontSize : 0;

  // Display scaling never changes the natural dimensions observed for fitting.
  useFrame(({ camera: activeCamera, size }) => {
    const element = content.current;
    const object = group.current;
    if (!(element && object)) {
      return;
    }
    if (worldFontSize <= 0) {
      if (lastScale.current !== 1) {
        element.style.scale = "1";
        lastScale.current = 1;
      }
      return;
    }
    if (size.height <= 0) {
      return;
    }
    object.getWorldPosition(labelPosition);
    activeCamera.getWorldPosition(cameraPosition);
    const pixelsPerUnit = isOrthographicCamera(activeCamera)
      ? activeCamera.zoom
      : size.height /
        (2 *
          Math.tan(MathUtils.degToRad(activeCamera.fov) / 2) *
          labelPosition.distanceTo(cameraPosition));
    const naturalSize = worldFontSize * pixelsPerUnit;
    if (!(Number.isFinite(naturalSize) && naturalSize > 0)) {
      return;
    }
    const nextScale =
      MathUtils.clamp(naturalSize, leastSize, largestSize) / naturalSize;
    if (
      !Number.isFinite(lastScale.current) ||
      Math.abs(nextScale - lastScale.current) > 1e-4
    ) {
      element.style.scale = `${nextScale}`;
      lastScale.current = nextScale;
    }
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
          pixels: {
            width: (element.offsetWidth * leastSize) / LABEL_BASE_FONT_SIZE,
            height: (element.offsetHeight * leastSize) / LABEL_BASE_FONT_SIZE,
          },
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
      leastSize,
      rotation,
      worldFontSize,
    ]
  );

  const style = useMemo<ComponentProps<typeof SceneHtml>["style"]>(
    () => ({
      WebkitTextStroke:
        outlineColor && outlineWidthEm > 0
          ? `${outlineWidthEm}em ${outlineColor}`
          : `${LABEL_HALO_EM}em var(--card)`,
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
    }),
    [
      anchorX,
      anchorY,
      gapPixels,
      labelColor,
      outlineColor,
      outlineWidthEm,
      rotation,
    ]
  );
  const labelValues = useMemo(
    () => ({ distanceFactor, measure: measureLabel, occlude, style }),
    [distanceFactor, measureLabel, occlude, style]
  );

  if (!visible) {
    return null;
  }

  return (
    <group {...(position === undefined ? {} : { position })} ref={group}>
      <LabelContext value={labelValues}>
        <LabelHtml>
          <span
            aria-hidden="true"
            // A formula draws once, at the size of the words around it. The label is
            // hidden from assistive technology, so KaTeX's MathML copy has no reader
            // here and never shows, whether or not the page loaded the KaTeX
            // stylesheet, and KaTeX's own 1.21em gives way to the label's size.
            className="[&_.katex]:text-[1em]! [&_.katex-mathml]:hidden"
            ref={attachContent}
            style={{
              display: "inline-block",
              transformOrigin: `${anchorOrigin(anchorX)} ${anchorOrigin(anchorY)}`,
              verticalAlign: "top",
            }}
          >
            {children}
          </span>
        </LabelHtml>
      </LabelContext>
    </group>
  );
}
