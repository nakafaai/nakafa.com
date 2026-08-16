"use client";

import { Line } from "@react-three/drei";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  ORIGIN_COLOR,
  THREE_FONT_SIZE,
} from "@repo/design-system/components/three/data/constants";
import {
  createArcPoints,
  GRAPH_ANGLE_ARC_SEGMENTS,
  GRAPH_FULL_CIRCLE_SEGMENTS,
  GRAPH_POINT_SEGMENTS,
} from "@repo/design-system/components/three/helpers/quality";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { COLORS } from "@repo/design-system/lib/color";
import {
  getCos,
  getRadians,
  getSin,
  getTan,
} from "@repo/design-system/lib/geometry/angles";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useMemo } from "react";
import { MeshBasicMaterial, SphereGeometry, Vector3 } from "three";

interface Props {
  /** Angle in degrees */
  angle?: number;
  /** Display mode for values */
  displayMode?: "decimal" | "exact";
  /** Precision for decimal values */
  precision?: number;
  /** Show labels for trig functions */
  showLabels?: boolean;
  /** Exact trigonometric values as fractions (e.g., "5/13", "12/13", "5/12") */
  trigValues?: {
    sin?: string;
    cos?: string;
    tan?: string;
  };
  /** Additional props */
  [key: string]: unknown;
}

const SPHERE_RADIUS = 0.05;
const ARC_RADIUS = 0.3;
const LABEL_FONT_SIZE = THREE_FONT_SIZE.compact;
const EPSILON = 1e-10;

// Label positioning constants
const ANGLE_LABEL_X_FACTOR = 0.55;
const ANGLE_LABEL_Y_FACTOR = 0.4;
const COS_LABEL_Y_OFFSET = -0.2;
const SIN_LABEL_X_OFFSET = 0.2;
const TAN_LABEL_POSITION = 1.1;
const THREE = 3;
const SQRT_3 = Math.sqrt(THREE);
const TWO = 2;
const FOUR = 4;
const ONE = 1;
const FULL_CIRCLE_RADIANS = Math.PI * 2;

// Pre-calculate static circle points once.
const STATIC_CIRCLE_POINTS = createArcPoints(
  1,
  FULL_CIRCLE_RADIANS,
  GRAPH_FULL_CIRCLE_SEGMENTS
);

// Shared geometry instances
let sharedSphereGeometry: SphereGeometry | null = null;
const sharedMaterials: Map<string, MeshBasicMaterial> = new Map();

/**
 * Reuses point marker geometry across unit-circle renders.
 *
 * @see https://r3f.docs.pmnd.rs/advanced/scaling-performance#re-using-geometries-and-materials
 */
function getSharedSphereGeometry() {
  if (!sharedSphereGeometry) {
    sharedSphereGeometry = new SphereGeometry(
      SPHERE_RADIUS,
      GRAPH_POINT_SEGMENTS,
      GRAPH_POINT_SEGMENTS
    );
  }
  return sharedSphereGeometry;
}

/**
 * Reuses unit-circle materials by color for labels and point markers.
 *
 * @see https://r3f.docs.pmnd.rs/advanced/scaling-performance#re-using-geometries-and-materials
 */
function getSharedMaterial(color: string) {
  if (!sharedMaterials.has(color)) {
    sharedMaterials.set(color, new MeshBasicMaterial({ color }));
  }
  const material = sharedMaterials.get(color);
  if (!material) {
    throw new Error(`Material not found for color: ${color}`);
  }
  return material;
}

/**
 * Renders the interactive unit-circle scene with smooth circle and angle arcs.
 */
export function UnitCircle({
  angle = 45,
  showLabels = true,
  displayMode = "exact",
  precision = 2,
  trigValues,
  ...props
}: Props) {
  const t = useTranslations("Common");
  const { resolvedTheme } = useTheme();

  const angleInRadians = getRadians(angle);
  const sin = getSin(angle);
  const cos = getCos(angle);
  const tan = getTan(angle);

  const arcPoints = useMemo(
    () => createArcPoints(ARC_RADIUS, angleInRadians, GRAPH_ANGLE_ARC_SEGMENTS),
    [angleInRadians]
  );

  // Format values according to display mode - memoize the function
  const formatValue = useMemo(() => {
    return (value: number) => {
      if (!Number.isFinite(value)) {
        return null;
      }
      if (Math.abs(value) < EPSILON) {
        return "0";
      }

      if (displayMode === "decimal") {
        return value.toFixed(precision);
      }

      const absValue = Math.abs(value);
      const sign = value < 0 ? "-" : "";

      // Common trig values lookup table for performance
      const commonValues = [
        { value: ONE / TWO, display: "\\frac{1}{2}" },
        { value: Math.SQRT1_2, display: "\\frac{\\sqrt{2}}{2}" },
        { value: SQRT_3 / TWO, display: "\\frac{\\sqrt{3}}{2}" },
        { value: ONE, display: "1" },
        { value: SQRT_3, display: "\\sqrt{3}" },
        { value: SQRT_3 / THREE, display: "\\frac{\\sqrt{3}}{3}" },
        { value: Math.SQRT2, display: "\\sqrt{2}" },
        { value: ONE / FOUR, display: "\\frac{1}{4}" },
        { value: THREE / FOUR, display: "\\frac{3}{4}" },
      ];

      for (const { value: v, display } of commonValues) {
        if (Math.abs(absValue - v) < EPSILON) {
          return `${sign}${display}`;
        }
      }

      return value.toFixed(precision);
    };
  }, [displayMode, precision]);

  // Memoize labels
  const labels = useMemo(() => {
    // If trigValues are provided, use them for fraction display
    if (trigValues) {
      return {
        sin: trigValues.sin ?? formatValue(sin),
        cos: trigValues.cos ?? formatValue(cos),
        tan: trigValues.tan ?? formatValue(tan),
      };
    }

    return {
      sin: formatValue(sin),
      cos: formatValue(cos),
      tan: formatValue(tan),
    };
  }, [sin, cos, tan, formatValue, trigValues]);

  // Colors based on theme
  const circleColor =
    getThemeAppearance(resolvedTheme) === "dark"
      ? ORIGIN_COLOR.LIGHT
      : ORIGIN_COLOR.DARK;

  // Pre-calculate positions
  const pointPosition = useMemo(() => new Vector3(cos, sin, 0), [cos, sin]);
  const origin = useMemo(() => new Vector3(0, 0, 0), []);
  const cosPoint = useMemo(() => new Vector3(cos, 0, 0), [cos]);

  // Line segments for better performance
  const lineSegments = useMemo(
    () => ({
      radius: [origin, pointPosition],
      sine: [cosPoint, pointPosition],
      cosine: [origin, cosPoint],
    }),
    [origin, pointPosition, cosPoint]
  );

  // Get shared geometry and material
  const sphereGeometry = getSharedSphereGeometry();
  const sphereMaterial = getSharedMaterial(circleColor);

  return (
    <group frustumCulled {...props}>
      {/* Unit Circle (XY plane) */}
      <group rotation={[0, 0, 0]}>
        {/* Circle outline */}
        <Line
          color={circleColor}
          frustumCulled
          lineWidth={2}
          points={STATIC_CIRCLE_POINTS}
        />

        {/* Angle arc */}
        <Line
          color={COLORS.VIOLET}
          frustumCulled
          lineWidth={2}
          points={arcPoints}
        />

        {/* Angle label */}
        <ThreeLabel
          anchorX="center"
          color={COLORS.VIOLET}
          fontSize={LABEL_FONT_SIZE}
          position={[
            Math.cos(angleInRadians / 2) * ANGLE_LABEL_X_FACTOR,
            Math.sin(angleInRadians / 2) * ANGLE_LABEL_Y_FACTOR,
            0,
          ]}
          visible={showLabels}
        >
          <InlineMath math={`${angle}^\\circ`} />
        </ThreeLabel>

        {/* Point on circle - using shared geometry */}
        <mesh
          frustumCulled
          geometry={sphereGeometry}
          material={sphereMaterial}
          position={pointPosition}
        />

        {/* Line from origin to point */}
        <Line
          color={COLORS.ROSE}
          frustumCulled
          lineWidth={2}
          points={lineSegments.radius}
        />

        {/* Sine line (vertical) */}
        <Line
          color={COLORS.ORANGE}
          frustumCulled
          lineWidth={2}
          points={lineSegments.sine}
        />

        {/* Cosine line (horizontal) */}
        <Line
          color={COLORS.CYAN}
          frustumCulled
          lineWidth={2}
          points={lineSegments.cosine}
        />

        {/* Trig value labels - only render if visible */}
        {!!showLabels && (
          <>
            <ThreeLabel
              anchorX="center"
              color={COLORS.CYAN}
              fontSize={LABEL_FONT_SIZE}
              position={[cos / 2, COS_LABEL_Y_OFFSET, 0]}
            >
              <InlineMath
                math={`\\cos\\left(${angle}^\\circ\\right) = ${labels.cos}`}
              />
            </ThreeLabel>
            <ThreeLabel
              anchorX="left"
              color={COLORS.ORANGE}
              fontSize={LABEL_FONT_SIZE}
              position={[cos + SIN_LABEL_X_OFFSET, sin / 2, 0]}
            >
              <InlineMath
                math={`\\sin\\left(${angle}^\\circ\\right) = ${labels.sin}`}
              />
            </ThreeLabel>
            <ThreeLabel
              color={COLORS.ROSE}
              fontSize={LABEL_FONT_SIZE}
              position={[TAN_LABEL_POSITION, TAN_LABEL_POSITION, 0]}
            >
              {labels.tan ? (
                <InlineMath
                  math={`\\tan\\left(${angle}^\\circ\\right) = ${labels.tan}`}
                />
              ) : (
                <>
                  <InlineMath math={`\\tan\\left(${angle}^\\circ\\right) =`} />{" "}
                  {t("undefined")}
                </>
              )}
            </ThreeLabel>
          </>
        )}
      </group>
    </group>
  );
}
