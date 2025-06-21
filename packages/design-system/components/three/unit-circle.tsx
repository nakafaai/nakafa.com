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
import * as THREE from "three";
import { FONT_PATH, MONO_FONT_PATH, ORIGIN_COLOR } from "./_data";

type Props = {
  /** Angle in degrees */
  angle?: number;
  /** Show labels for trig functions */
  showLabels?: boolean;
  /** Display mode for values */
  displayMode?: "decimal" | "exact";
  /** Precision for decimal values */
  precision?: number;
  /** Use mono font for the labels */
  useMonoFont?: boolean;
  /** Additional props */
  [key: string]: unknown;
};

// Optimized settings for performance
const UNIT_CIRCLE_SEGMENTS = 48; // Reduced from 64
const UNIT_ARC_SEGMENTS = 16; // Reduced from 24
const SPHERE_SEGMENTS = 8; // Low poly sphere

// Pre-calculate static circle points once
const STATIC_CIRCLE_POINTS: THREE.Vector3[] = (() => {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= UNIT_CIRCLE_SEGMENTS; i++) {
    const a = (i / UNIT_CIRCLE_SEGMENTS) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
  }
  return pts;
})();

// Shared geometry instances
let sharedSphereGeometry: THREE.SphereGeometry | null = null;
const sharedMaterials: Map<string, THREE.MeshBasicMaterial> = new Map();

function getSharedSphereGeometry() {
  if (!sharedSphereGeometry) {
    sharedSphereGeometry = new THREE.SphereGeometry(
      0.05,
      SPHERE_SEGMENTS,
      SPHERE_SEGMENTS
    );
  }
  return sharedSphereGeometry;
}

function getSharedMaterial(color: string) {
  if (!sharedMaterials.has(color)) {
    sharedMaterials.set(color, new THREE.MeshBasicMaterial({ color }));
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
  ...props
}: Props) {
  const t = useTranslations("Common");
  const { resolvedTheme } = useTheme();
  const groupRef = useRef<THREE.Group>(null);

  const angleInRadians = getRadians(angle);
  const sin = getSin(angle);
  const cos = getCos(angle);
  const tan = getTan(angle);

  // Use precomputed circle outline points (static)
  const circlePoints = STATIC_CIRCLE_POINTS;

  // Memoize angle arc points with reduced segments
  const arcPoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= UNIT_ARC_SEGMENTS; i++) {
      const a = (i / UNIT_ARC_SEGMENTS) * angleInRadians;
      pts.push(new THREE.Vector3(Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0));
    }
    return pts;
  }, [angleInRadians]);

  // Format values according to display mode - memoize the function
  const formatValue = useMemo(() => {
    return (value: number) => {
      if (!Number.isFinite(value)) {
        return t("undefined");
      }
      if (Math.abs(value) < 1e-10) {
        return "0";
      }

      if (displayMode === "decimal") {
        return value.toFixed(precision);
      }

      const absValue = Math.abs(value);
      const sign = value < 0 ? "-" : "";

      // Common trig values lookup table for performance
      const commonValues = [
        { value: 0.5, display: "1/2" },
        { value: Math.SQRT1_2, display: "√2/2" },
        { value: Math.sqrt(3) / 2, display: "√3/2" },
        { value: 1, display: "1" },
        { value: Math.sqrt(3), display: "√3" },
        { value: Math.sqrt(3) / 3, display: "√3/3" },
        { value: Math.SQRT2, display: "√2" },
        { value: 0.25, display: "1/4" },
        { value: 0.75, display: "3/4" },
      ];

      for (const { value: v, display } of commonValues) {
        if (Math.abs(absValue - v) < 1e-10) {
          return `${sign}${display}`;
        }
      }

      return value.toFixed(precision);
    };
  }, [displayMode, precision, t]);

  // Memoize labels
  const labels = useMemo(
    () => ({
      sin: `sin(${angle}°) = ${formatValue(sin)}`,
      cos: `cos(${angle}°) = ${formatValue(cos)}`,
      tan: `tan(${angle}°) = ${formatValue(tan)}`,
    }),
    [angle, sin, cos, tan, formatValue]
  );

  const fontPath = useMonoFont ? MONO_FONT_PATH : FONT_PATH;

  // Colors based on theme
  const circleColor =
    resolvedTheme === "dark" ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK;

  // Pre-calculate positions
  const pointPosition = useMemo(
    () => new THREE.Vector3(cos, sin, 0),
    [cos, sin]
  );
  const origin = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const cosPoint = useMemo(() => new THREE.Vector3(cos, 0, 0), [cos]);

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
          points={circlePoints}
          color={circleColor}
          lineWidth={2}
          frustumCulled
        />

        {/* Angle arc */}
        <Line
          points={arcPoints}
          color={COLORS.VIOLET}
          lineWidth={2}
          frustumCulled
        />

        {/* Angle label */}
        <Text
          position={[
            Math.cos(angleInRadians / 2) * 0.5,
            Math.sin(angleInRadians / 2) * 0.4,
            0,
          ]}
          color={COLORS.VIOLET}
          fontSize={0.12}
          font={fontPath}
          visible={showLabels}
          frustumCulled
          anchorX="center"
          anchorY="middle"
        >
          {`${angle}°`}
        </Text>

        {/* Point on circle - using shared geometry */}
        <mesh
          position={pointPosition}
          geometry={sphereGeometry}
          material={sphereMaterial}
          frustumCulled
        />

        {/* Line from origin to point */}
        <Line
          points={lineSegments.radius}
          color={COLORS.ROSE}
          lineWidth={2}
          frustumCulled
        />

        {/* Sine line (vertical) */}
        <Line
          points={lineSegments.sine}
          color={COLORS.ORANGE}
          lineWidth={2}
          frustumCulled
        />

        {/* Cosine line (horizontal) */}
        <Line
          points={lineSegments.cosine}
          color={COLORS.CYAN}
          lineWidth={2}
          frustumCulled
        />

        {/* Trig value labels - only render if visible */}
        {showLabels && (
          <>
            <Text
              position={[cos / 2, -0.2, 0]}
              color={COLORS.CYAN}
              fontSize={0.12}
              font={fontPath}
              anchorX="center"
              frustumCulled
            >
              {labels.cos}
            </Text>
            <Text
              position={[cos + 0.2, sin / 2, 0]}
              color={COLORS.ORANGE}
              fontSize={0.12}
              font={fontPath}
              anchorX="left"
              anchorY="middle"
              frustumCulled
            >
              {labels.sin}
            </Text>
            <Text
              position={[1.1, 1.1, 0]}
              color={COLORS.ROSE}
              fontSize={0.12}
              font={fontPath}
              frustumCulled
            >
              {labels.tan}
            </Text>
          </>
        )}
      </group>
    </group>
  );
}
