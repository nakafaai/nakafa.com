"use client";

import { Line, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { COLORS } from "@repo/design-system/lib/color";
import {
  getCos,
  getRadians,
  getSin,
  getTan,
} from "@repo/design-system/lib/math";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useMemo, useRef } from "react";
import { type Group, MeshBasicMaterial, SphereGeometry, Vector3 } from "three";
import { FONT_PATH, MONO_FONT_PATH, ORIGIN_COLOR } from "./_data";

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
  /** Use mono font for the labels */
  useMonoFont?: boolean;
  /** Additional props */
  [key: string]: unknown;
}

// Optimized settings for performance
const UNIT_CIRCLE_SEGMENTS = 48; // Reduced from 64
const UNIT_ARC_SEGMENTS = 16; // Reduced from 24
const SPHERE_SEGMENTS = 8; // Low poly sphere
const SPHERE_RADIUS = 0.05;
const ARC_RADIUS = 0.3;
const LABEL_FONT_SIZE = 0.12;
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

// Pre-calculate static circle points once
const STATIC_CIRCLE_POINTS: Vector3[] = (() => {
  const pts: Vector3[] = [];
  for (let i = 0; i <= UNIT_CIRCLE_SEGMENTS; i += 1) {
    const a = (i / UNIT_CIRCLE_SEGMENTS) * Math.PI * 2;
    pts.push(new Vector3(Math.cos(a), Math.sin(a), 0));
  }
  return pts;
})();

// Shared geometry instances
let sharedSphereGeometry: SphereGeometry | null = null;
const sharedMaterials: Map<string, MeshBasicMaterial> = new Map();

function getSharedSphereGeometry() {
  if (!sharedSphereGeometry) {
    sharedSphereGeometry = new SphereGeometry(
      SPHERE_RADIUS,
      SPHERE_SEGMENTS,
      SPHERE_SEGMENTS
    );
  }
  return sharedSphereGeometry;
}

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

export function UnitCircle({
  angle = 45,
  showLabels = true,
  displayMode = "exact",
  precision = 2,
  useMonoFont = true,
  trigValues,
  ...props
}: Props) {
  const t = useTranslations("Common");
  const { resolvedTheme } = useTheme();
  const groupRef = useRef<Group>(null);

  const angleInRadians = getRadians(angle);
  const sin = getSin(angle);
  const cos = getCos(angle);
  const tan = getTan(angle);

  // Use precomputed circle outline points (static)
  const circlePoints = STATIC_CIRCLE_POINTS;

  // Memoize angle arc points with reduced segments
  const arcPoints = useMemo(() => {
    const pts: Vector3[] = [];
    for (let i = 0; i <= UNIT_ARC_SEGMENTS; i += 1) {
      const a = (i / UNIT_ARC_SEGMENTS) * angleInRadians;
      pts.push(
        new Vector3(Math.cos(a) * ARC_RADIUS, Math.sin(a) * ARC_RADIUS, 0)
      );
    }
    return pts;
  }, [angleInRadians]);

  // Format values according to display mode - memoize the function
  const formatValue = useMemo(() => {
    return (value: number) => {
      if (!Number.isFinite(value)) {
        return t("undefined");
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
        { value: ONE / TWO, display: "1/2" },
        { value: Math.SQRT1_2, display: "√2/2" },
        { value: SQRT_3 / TWO, display: "√3/2" },
        { value: ONE, display: "1" },
        { value: SQRT_3, display: "√3" },
        { value: SQRT_3 / THREE, display: "√3/3" },
        { value: Math.SQRT2, display: "√2" },
        { value: ONE / FOUR, display: "1/4" },
        { value: THREE / FOUR, display: "3/4" },
      ];

      for (const { value: v, display } of commonValues) {
        if (Math.abs(absValue - v) < EPSILON) {
          return `${sign}${display}`;
        }
      }

      return value.toFixed(precision);
    };
  }, [displayMode, precision, t]);

  // Memoize labels
  const labels = useMemo(() => {
    // If trigValues are provided, use them for fraction display
    if (trigValues) {
      return {
        sin: trigValues.sin
          ? `sin(${angle}°) = ${trigValues.sin}`
          : `sin(${angle}°) = ${formatValue(sin)}`,
        cos: trigValues.cos
          ? `cos(${angle}°) = ${trigValues.cos}`
          : `cos(${angle}°) = ${formatValue(cos)}`,
        tan: trigValues.tan
          ? `tan(${angle}°) = ${trigValues.tan}`
          : `tan(${angle}°) = ${formatValue(tan)}`,
      };
    }

    return {
      sin: `sin(${angle}°) = ${formatValue(sin)}`,
      cos: `cos(${angle}°) = ${formatValue(cos)}`,
      tan: `tan(${angle}°) = ${formatValue(tan)}`,
    };
  }, [angle, sin, cos, tan, formatValue, trigValues]);

  const fontPath = useMonoFont ? MONO_FONT_PATH : FONT_PATH;

  // Colors based on theme
  const circleColor =
    resolvedTheme === "dark" ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK;

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

  // Use frustum culling
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.frustumCulled = true;
    }
  });

  // Get shared geometry and material
  const sphereGeometry = getSharedSphereGeometry();
  const sphereMaterial = getSharedMaterial(circleColor);

  return (
    <group ref={groupRef} {...props}>
      {/* Unit Circle (XY plane) */}
      <group rotation={[0, 0, 0]}>
        {/* Circle outline */}
        <Line
          color={circleColor}
          frustumCulled
          lineWidth={2}
          points={circlePoints}
        />

        {/* Angle arc */}
        <Line
          color={COLORS.VIOLET}
          frustumCulled
          lineWidth={2}
          points={arcPoints}
        />

        {/* Angle label */}
        <Text
          anchorX="center"
          anchorY="middle"
          color={COLORS.VIOLET}
          font={fontPath}
          fontSize={LABEL_FONT_SIZE}
          frustumCulled
          position={[
            Math.cos(angleInRadians / 2) * ANGLE_LABEL_X_FACTOR,
            Math.sin(angleInRadians / 2) * ANGLE_LABEL_Y_FACTOR,
            0,
          ]}
          visible={showLabels}
        >
          {`${angle}°`}
        </Text>

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
            <Text
              anchorX="center"
              color={COLORS.CYAN}
              font={fontPath}
              fontSize={LABEL_FONT_SIZE}
              frustumCulled
              position={[cos / 2, COS_LABEL_Y_OFFSET, 0]}
            >
              {labels.cos}
            </Text>
            <Text
              anchorX="left"
              anchorY="middle"
              color={COLORS.ORANGE}
              font={fontPath}
              fontSize={LABEL_FONT_SIZE}
              frustumCulled
              position={[cos + SIN_LABEL_X_OFFSET, sin / 2, 0]}
            >
              {labels.sin}
            </Text>
            <Text
              color={COLORS.ROSE}
              font={fontPath}
              fontSize={LABEL_FONT_SIZE}
              frustumCulled
              position={[TAN_LABEL_POSITION, TAN_LABEL_POSITION, 0]}
            >
              {labels.tan}
            </Text>
          </>
        )}
      </group>
    </group>
  );
}
