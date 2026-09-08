"use client";

import { Instance, Instances, Line } from "@react-three/drei";
import {
  ORIGIN_COLOR,
  THREE_DIAGRAM_MINIMUM_FONT_SIZE,
  THREE_FONT_SIZE,
} from "@repo/design-system/components/three/data/constants";
import {
  createArcPoints,
  GRAPH_ANGLE_ARC_SEGMENTS,
  GRAPH_POINT_SEGMENTS,
} from "@repo/design-system/components/three/helpers/quality";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { COLORS } from "@repo/design-system/lib/color";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { getCos, getRadians, getSin } from "@repo/math/angles";
import { useTheme } from "next-themes";
import { type ComponentProps, type ReactNode, useMemo } from "react";
import { Vector3 } from "three";

// Sizing and scaling constants
const BASE_FONT_SIZE = THREE_FONT_SIZE.compact;
const BASE_VERTEX_SIZE = 0.05;
const VERTEX_SIZE_SCALE_FACTOR = 0.05;
const ARC_RADIUS_SCALE_FACTOR = 0.2;
const MIN_SCALE_FACTOR = 1;

// Label offset multipliers
const LABEL_OFFSET_ADJACENT_Y = 1.5;
const LABEL_OFFSET_OPPOSITE_X = 4;
const LABEL_OFFSET_HYPOTENUSE_Y = 2;

const TRIANGLE_SIDE_CONFIG = [
  { color: COLORS.CYAN, key: "adjacent" },
  { color: COLORS.ORANGE, key: "opposite" },
  { color: COLORS.ROSE, key: "hypotenuse" },
];

interface Props {
  /** Angle in degrees */
  angle?: number;
  /** Labels for the triangle */
  labels?: {
    opposite: ReactNode;
    adjacent: ReactNode;
    hypotenuse: ReactNode;
  };
  /** Size of the triangle (scale factor) */
  size?: number;
}

/**
 * Renders a trigonometric triangle with smooth angle arcs and reusable markers.
 */
export function Triangle({
  angle = 45,
  size = 1,
  labels = {
    opposite: "Opposite",
    adjacent: "Adjacent",
    hypotenuse: "Hypotenuse",
  },
  ...props
}: Props & ComponentProps<"group">) {
  const { resolvedTheme } = useTheme();

  const angleInRadians = getRadians(angle);

  // Create a right triangle with sides of variable length based on the angle
  const hypotenuse = size; // Scale the hypotenuse by the size parameter
  const adjacent = getCos(angle) * hypotenuse;
  const opposite = getSin(angle) * hypotenuse;

  // Colors based on theme
  const baseColor =
    getThemeAppearance(resolvedTheme) === "dark"
      ? ORIGIN_COLOR.LIGHT
      : ORIGIN_COLOR.DARK;

  // Scale the vertex points based on triangle size
  const vertexSize =
    BASE_VERTEX_SIZE *
    Math.max(MIN_SCALE_FACTOR, size * VERTEX_SIZE_SCALE_FACTOR);

  // Scale the angle arc radius based on triangle size - make it more proportional
  const arcRadius = ARC_RADIUS_SCALE_FACTOR * Math.sqrt(size);

  // Memoize triangle side segments
  const triangleSideLines = useMemo(() => {
    const origin = new Vector3(0, 0, 0);
    const adj = new Vector3(adjacent, 0, 0);
    const opp = new Vector3(adjacent, opposite, 0);
    return [
      [origin, adj],
      [adj, opp],
      [opp, origin],
    ];
  }, [adjacent, opposite]);

  const triangleArcPoints = useMemo(
    () => createArcPoints(arcRadius, angleInRadians, GRAPH_ANGLE_ARC_SEGMENTS),
    [angleInRadians, arcRadius]
  );

  // Vertices for instancing with semantic labels
  const triangleVertices = useMemo(() => {
    const vertices = triangleSideLines.map((pts) => pts[0]);
    return [
      { position: vertices[1], key: "adjacent" },
      { position: vertices[2], key: "opposite" },
    ];
  }, [triangleSideLines]);

  // Side signs keep the labels outside the triangle in every quadrant.
  const horizontalDirection = adjacent < 0 ? -1 : 1;
  const verticalDirection = opposite < 0 ? -1 : 1;
  const labelPositions = useMemo(
    () => ({
      adjacentLabelPos: new Vector3(
        adjacent / 2,
        -verticalDirection * BASE_FONT_SIZE * LABEL_OFFSET_ADJACENT_Y,
        0
      ),
      oppositeLabelPos: new Vector3(
        adjacent +
          horizontalDirection * BASE_FONT_SIZE * LABEL_OFFSET_OPPOSITE_X,
        opposite / 2,
        0
      ),
      hypotenuseLabelPos: new Vector3(
        adjacent / 2 -
          horizontalDirection *
            Math.abs(getSin(angle)) *
            BASE_FONT_SIZE *
            LABEL_OFFSET_HYPOTENUSE_Y,
        opposite / 2 +
          verticalDirection *
            Math.abs(getCos(angle)) *
            BASE_FONT_SIZE *
            LABEL_OFFSET_HYPOTENUSE_Y,
        0
      ),
    }),
    [adjacent, angle, horizontalDirection, opposite, verticalDirection]
  );
  const hypotenuseLabelRotation =
    Math.atan2(opposite, adjacent) + (adjacent < 0 ? Math.PI : 0);

  return (
    <group frustumCulled {...props}>
      {/* Draw the triangle sides - optimized with single color array access */}
      {triangleSideLines.map((pts, i) => (
        <Line
          color={TRIANGLE_SIDE_CONFIG[i].color}
          frustumCulled
          key={TRIANGLE_SIDE_CONFIG[i].key}
          lineWidth={2}
          points={pts}
        />
      ))}

      {/* Angle arc */}
      <Line
        color={COLORS.VIOLET}
        frustumCulled
        lineWidth={2}
        points={triangleArcPoints}
      />

      {/* Side labels */}
      <ThreeLabel
        anchorX={adjacent >= 0 ? "left" : "right"}
        color={COLORS.CYAN}
        fontSize={BASE_FONT_SIZE}
        minimumFontSize={THREE_DIAGRAM_MINIMUM_FONT_SIZE}
        position={labelPositions.adjacentLabelPos}
      >
        {labels.adjacent}
      </ThreeLabel>

      <ThreeLabel
        anchorX={opposite >= 0 ? "left" : "right"}
        color={COLORS.ORANGE}
        fontSize={BASE_FONT_SIZE}
        minimumFontSize={THREE_DIAGRAM_MINIMUM_FONT_SIZE}
        position={labelPositions.oppositeLabelPos}
        rotation={-Math.PI / 2}
      >
        {labels.opposite}
      </ThreeLabel>

      <ThreeLabel
        anchorX="center"
        color={COLORS.ROSE}
        fontSize={BASE_FONT_SIZE}
        minimumFontSize={THREE_DIAGRAM_MINIMUM_FONT_SIZE}
        position={labelPositions.hypotenuseLabelPos}
        rotation={-hypotenuseLabelRotation}
      >
        {labels.hypotenuse}
      </ThreeLabel>

      {/* Points at vertices - using instanced rendering */}
      <Instances count={triangleVertices.length} frustumCulled visible>
        <sphereGeometry
          args={[1, GRAPH_POINT_SEGMENTS, GRAPH_POINT_SEGMENTS]}
        />
        <meshBasicMaterial color={baseColor} />
        {triangleVertices.map((vertex) => (
          <Instance
            key={vertex.key}
            position={[vertex.position.x, vertex.position.y, vertex.position.z]}
            scale={vertexSize}
          />
        ))}
      </Instances>
    </group>
  );
}
