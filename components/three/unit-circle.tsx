"use client";

import { COLORS } from "@/lib/utils/color";
import { getCos, getRadians, getSin, getTan } from "@/lib/utils/math";
import { Line, Text } from "@react-three/drei";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useMemo } from "react";
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

const UNIT_CIRCLE_SEGMENTS = 64;
const UNIT_ARC_SEGMENTS = 24;
const STATIC_CIRCLE_POINTS: THREE.Vector3[] = (() => {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= UNIT_CIRCLE_SEGMENTS; i++) {
    const a = (i / UNIT_CIRCLE_SEGMENTS) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
  }
  return pts;
})();

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

  const angleInRadians = getRadians(angle);
  const sin = getSin(angle);
  const cos = getCos(angle);
  const tan = getTan(angle);

  // Use precomputed circle outline points (static)
  const circlePoints = STATIC_CIRCLE_POINTS;

  // Memoize angle arc points
  const arcPoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= UNIT_ARC_SEGMENTS; i++) {
      const a = (i / UNIT_ARC_SEGMENTS) * angleInRadians;
      pts.push(new THREE.Vector3(Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0));
    }
    return pts;
  }, [angleInRadians]);

  // Format values according to display mode
  const formatValue = (value: number) => {
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

    // More systematic approach for exact mode
    // Check for common trig values

    // sin(π/6) = cos(π/3) = 1/2
    if (Math.abs(absValue - 0.5) < 1e-10) {
      return `${sign}1/2`;
    }

    // sin(π/4) = cos(π/4) = √2/2
    if (Math.abs(absValue - Math.SQRT1_2) < 1e-10) {
      return `${sign}√2/2`;
    }

    // sin(π/3) = cos(π/6) = √3/2
    if (Math.abs(absValue - Math.sqrt(3) / 2) < 1e-10) {
      return `${sign}√3/2`;
    }

    // sin(0) = 0, sin(π) = 0
    if (Math.abs(absValue) < 1e-10) {
      return "0";
    }

    // sin(π/2) = 1, cos(0) = 1
    if (Math.abs(absValue - 1) < 1e-10) {
      return `${sign}1`;
    }

    // tan(π/3) = √3
    if (Math.abs(absValue - Math.sqrt(3)) < 1e-10) {
      return `${sign}√3`;
    }

    // tan(π/4) = 1
    // already covered by the absValue === 1 check

    // tan(π/6) = 1/√3 = √3/3
    if (Math.abs(absValue - Math.sqrt(3) / 3) < 1e-10) {
      return `${sign}√3/3`;
    }

    // √2
    if (Math.abs(absValue - Math.SQRT2) < 1e-10) {
      return `${sign}√2`;
    }

    // 1/4 and 3/4 for completeness
    if (Math.abs(absValue - 0.25) < 1e-10) {
      return `${sign}1/4`;
    }
    if (Math.abs(absValue - 0.75) < 1e-10) {
      return `${sign}3/4`;
    }

    return value.toFixed(precision);
  };

  const sinLabel = `sin(${angle}°) = ${formatValue(sin)}`;
  const cosLabel = `cos(${angle}°) = ${formatValue(cos)}`;
  const tanLabel = `tan(${angle}°) = ${formatValue(tan)}`;

  const fontPath = useMonoFont ? MONO_FONT_PATH : FONT_PATH;

  return (
    <group {...props}>
      {/* Unit Circle (XY plane) */}
      <group rotation={[0, 0, 0]}>
        {/* Circle outline */}
        <Line
          points={circlePoints}
          color={
            resolvedTheme === "dark" ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK
          }
          lineWidth={2}
        />

        {/* Angle arc */}
        <Line points={arcPoints} color={COLORS.VIOLET} lineWidth={2} />

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
        >
          {`${angle}°`}
        </Text>

        {/* Point on circle */}
        <mesh position={[cos, sin, 0]}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshBasicMaterial
            color={
              resolvedTheme === "dark" ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK
            }
          />
        </mesh>

        {/* Line from origin to point */}
        <Line
          points={[new THREE.Vector3(0, 0, 0), new THREE.Vector3(cos, sin, 0)]}
          color={COLORS.ROSE}
          lineWidth={2}
        />

        {/* Sine line (vertical) */}
        <Line
          points={[
            new THREE.Vector3(cos, 0, 0),
            new THREE.Vector3(cos, sin, 0),
          ]}
          color={COLORS.ORANGE}
          lineWidth={2}
        />

        {/* Cosine line (horizontal) */}
        <Line
          points={[new THREE.Vector3(0, 0, 0), new THREE.Vector3(cos, 0, 0)]}
          color={COLORS.CYAN}
          lineWidth={2}
        />

        {/* Trig value labels */}
        <Text
          visible={showLabels}
          position={[cos / 2, -0.2, 0]}
          color={COLORS.CYAN}
          fontSize={0.12}
          font={fontPath}
          anchorX="center"
        >
          {cosLabel}
        </Text>
        <Text
          visible={showLabels}
          position={[cos + 0.2, sin / 2, 0]}
          color={COLORS.ORANGE}
          fontSize={0.12}
          font={fontPath}
          anchorX="left"
          anchorY="middle"
        >
          {sinLabel}
        </Text>
        <Text
          visible={showLabels}
          position={[1.1, 1.1, 0]}
          color={COLORS.ROSE}
          fontSize={0.12}
          font={fontPath}
        >
          {tanLabel}
        </Text>
      </group>
    </group>
  );
}
