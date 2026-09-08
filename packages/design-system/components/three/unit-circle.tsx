"use client";

import { Line } from "@react-three/drei";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  ORIGIN_COLOR,
  THREE_DIAGRAM_MINIMUM_FONT_SIZE,
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
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { getCos, getRadians, getSin } from "@repo/math/angles";
import { useTheme } from "next-themes";
import { useMemo } from "react";
import { Vector3 } from "three";

interface Props {
  /** Angle in degrees */
  angle?: number;
  /** Show labels for trig functions */
  showLabels?: boolean;
  /** Additional props */
  [key: string]: unknown;
}

const SPHERE_RADIUS = 0.05;
const ARC_RADIUS = 0.45;
const LABEL_FONT_SIZE = THREE_FONT_SIZE.compact;
const EPSILON = 1e-10;

const FULL_CIRCLE_RADIANS = Math.PI * 2;

// Pre-calculate static circle points once.
const STATIC_CIRCLE_POINTS = createArcPoints(
  1,
  FULL_CIRCLE_RADIANS,
  GRAPH_FULL_CIRCLE_SEGMENTS
);

/**
 * Renders the interactive unit-circle scene with smooth circle and angle arcs.
 */
export function UnitCircle({ angle = 45, showLabels = true, ...props }: Props) {
  const { resolvedTheme } = useTheme();

  const angleInRadians = getRadians(angle);
  const sin = getSin(angle);
  const cos = getCos(angle);
  const sineLabelDirection = cos < -EPSILON ? -1 : 1;

  const arcPoints = useMemo(
    () => createArcPoints(ARC_RADIUS, angleInRadians, GRAPH_ANGLE_ARC_SEGMENTS),
    [angleInRadians]
  );

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
          anchorX={Math.cos(angleInRadians / 2) < 0 ? "right" : "left"}
          anchorY={Math.sin(angleInRadians / 2) < 0 ? "top" : "bottom"}
          color={COLORS.VIOLET}
          fontSize={LABEL_FONT_SIZE}
          gap={0.1}
          minimumFontSize={THREE_DIAGRAM_MINIMUM_FONT_SIZE}
          position={[
            Math.cos(angleInRadians / 2) * 0.7,
            Math.sin(angleInRadians / 2) * 0.7,
            0,
          ]}
          visible={showLabels && Math.abs(angle) > EPSILON}
        >
          <InlineMath math="\theta" />
        </ThreeLabel>

        <mesh frustumCulled position={pointPosition}>
          <sphereGeometry
            args={[SPHERE_RADIUS, GRAPH_POINT_SEGMENTS, GRAPH_POINT_SEGMENTS]}
          />
          <meshBasicMaterial color={circleColor} />
        </mesh>

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

        <ThreeLabel
          anchorX="center"
          anchorY={sin < -EPSILON ? "bottom" : "top"}
          color={COLORS.CYAN}
          fontSize={LABEL_FONT_SIZE}
          gap={0.1}
          minimumFontSize={THREE_DIAGRAM_MINIMUM_FONT_SIZE}
          position={[sineLabelDirection * 0.45, sin < -EPSILON ? 0.3 : -0.3, 0]}
          visible={showLabels && Math.abs(cos) > EPSILON}
        >
          <InlineMath math="\cos\theta" />
        </ThreeLabel>
        <ThreeLabel
          anchorX={sineLabelDirection < 0 ? "right" : "left"}
          color={COLORS.ORANGE}
          fontSize={LABEL_FONT_SIZE}
          gap={0.1}
          minimumFontSize={THREE_DIAGRAM_MINIMUM_FONT_SIZE}
          position={[
            Math.abs(cos) < EPSILON ? 0.25 : 1.1 * sineLabelDirection,
            Math.abs(cos) < EPSILON ? sin / 3 : sin / 2,
            0,
          ]}
          visible={showLabels && Math.abs(sin) > EPSILON}
        >
          <InlineMath math="\sin\theta" />
        </ThreeLabel>
      </group>
    </group>
  );
}
