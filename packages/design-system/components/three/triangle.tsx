"use client";

import { Instance, Instances, Line, Text } from "@react-three/drei";
import { COLORS } from "@repo/design-system/lib/color";
import { useTheme } from "next-themes";
import { useMemo } from "react";
import { MeshBasicMaterial, SphereGeometry, Vector3 } from "three";
import {
  FONT_PATH,
  MONO_FONT_PATH,
  ORIGIN_COLOR,
  THREE_FONT_SIZE,
} from "./_data";
import {
  createArcPoints,
  GRAPH_ANGLE_ARC_SEGMENTS,
  GRAPH_POINT_SEGMENTS,
} from "./quality";

// Angle and Quadrant constants
const DEGREES_IN_HALF_CIRCLE = 180;
const DEGREES_TO_RADIANS = Math.PI / DEGREES_IN_HALF_CIRCLE;
const DEGREES_IN_QUADRANT = 90;
const QUADRANTS_IN_CIRCLE = 4;

// Sizing and scaling constants
const BASE_FONT_SIZE = THREE_FONT_SIZE.compact;
const BASE_VERTEX_SIZE = 0.05;
const VERTEX_SIZE_SCALE_FACTOR = 0.05;
const ARC_RADIUS_SCALE_FACTOR = 0.2;
const ANGLE_LABEL_DISTANCE_SCALE_FACTOR = 0.3;
const MIN_SCALE_FACTOR = 1;

// Label offset multipliers
const LABEL_OFFSET_ADJACENT_Y = 1.5;
const LABEL_OFFSET_OPPOSITE_X = 4;
const LABEL_OFFSET_HYPOTENUSE_Y = 2;
const ANGLE_LABEL_POSITION_ADJUSTMENT = 0.5;

// Quadrant identifiers
const Q1 = 1;
const Q2 = 2;
const Q3 = 3;
const Q4 = 4;

interface Props {
  /** Angle in degrees */
  angle?: number;
  /** Labels for the triangle */
  labels?: {
    opposite: string;
    adjacent: string;
    hypotenuse: string;
  };
  /** Size of the triangle (scale factor) */
  size?: number;
  /** Use mono font for the labels */
  useMonoFont?: boolean;
  /** Additional props */
  [key: string]: unknown;
}

// Singleton geometry instances for reuse
let sharedSphereGeometry: SphereGeometry | null = null;
const sharedMaterials: Map<string, MeshBasicMaterial> = new Map();

/**
 * Reuses vertex marker geometry across triangle visualizations.
 *
 * @see https://r3f.docs.pmnd.rs/advanced/scaling-performance#re-using-geometries-and-materials
 */
function getSharedSphereGeometry() {
  if (!sharedSphereGeometry) {
    sharedSphereGeometry = new SphereGeometry(
      1,
      GRAPH_POINT_SEGMENTS,
      GRAPH_POINT_SEGMENTS
    );
  }
  return sharedSphereGeometry;
}

/**
 * Reuses triangle materials by color for repeated side and point rendering.
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
  useMonoFont = true,
  ...props
}: Props) {
  const { resolvedTheme } = useTheme();

  // Convert angle to radians and calculate the points
  const angleInRadians = angle * DEGREES_TO_RADIANS;

  // Identify which quadrant the angle is in
  const quadrant =
    (Math.floor(angle / DEGREES_IN_QUADRANT) % QUADRANTS_IN_CIRCLE) + Q1;

  // Create a right triangle with sides of variable length based on the angle
  const hypotenuse = size; // Scale the hypotenuse by the size parameter
  const adjacent = Math.cos(angleInRadians) * hypotenuse;
  const opposite = Math.sin(angleInRadians) * hypotenuse;

  // Font path based on the useMonoFont setting
  const fontPath = useMonoFont ? MONO_FONT_PATH : FONT_PATH;

  const fontSize = BASE_FONT_SIZE;

  // Colors based on theme
  const baseColor =
    resolvedTheme === "dark" ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK;

  // Scale the vertex points based on triangle size
  const vertexSize =
    BASE_VERTEX_SIZE *
    Math.max(MIN_SCALE_FACTOR, size * VERTEX_SIZE_SCALE_FACTOR);

  // Scale the angle arc radius based on triangle size - make it more proportional
  const arcRadius = ARC_RADIUS_SCALE_FACTOR * Math.sqrt(size);
  const angleLabelDistance =
    ANGLE_LABEL_DISTANCE_SCALE_FACTOR * Math.sqrt(size);

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
      { position: vertices[0], key: "origin" },
      { position: vertices[1], key: "adjacent" },
      { position: vertices[2], key: "opposite" },
    ];
  }, [triangleSideLines]);

  // Use shared geometry and material
  const sphereGeo = getSharedSphereGeometry();
  const sphereMat = getSharedMaterial(baseColor);

  // Determine label positions based on quadrant and angle
  const labelPositions = useMemo(() => {
    // Calculate midpoints for labels
    const adjacentMidpoint = new Vector3(adjacent / 2, 0, 0);
    const oppositeMidpoint = new Vector3(adjacent, opposite / 2, 0);
    const hypotenuseMidpoint = new Vector3(adjacent / 2, opposite / 2, 0);

    const adjacentLabelPos = new Vector3();
    const oppositeLabelPos = new Vector3();
    const hypotenuseLabelPos = new Vector3();

    // Combined switch statement for all label positions based on quadrant
    switch (quadrant) {
      case Q1: {
        // 0-90 degrees
        adjacentLabelPos
          .copy(adjacentMidpoint)
          .add(new Vector3(0, -fontSize * LABEL_OFFSET_ADJACENT_Y, 0));
        oppositeLabelPos
          .copy(oppositeMidpoint)
          .add(new Vector3(fontSize * LABEL_OFFSET_OPPOSITE_X, 0, 0));
        hypotenuseLabelPos
          .copy(hypotenuseMidpoint)
          .add(new Vector3(0, fontSize * LABEL_OFFSET_HYPOTENUSE_Y, 0));
        break;
      }

      case Q2: {
        // 90-180 degrees
        adjacentLabelPos
          .copy(adjacentMidpoint)
          .add(new Vector3(0, -fontSize * LABEL_OFFSET_ADJACENT_Y, 0));
        oppositeLabelPos
          .copy(oppositeMidpoint)
          .add(new Vector3(-fontSize * LABEL_OFFSET_OPPOSITE_X, 0, 0));
        hypotenuseLabelPos
          .copy(hypotenuseMidpoint)
          .add(new Vector3(0, fontSize * LABEL_OFFSET_HYPOTENUSE_Y, 0));
        break;
      }

      case Q3: {
        // 180-270 degrees
        adjacentLabelPos
          .copy(adjacentMidpoint)
          .add(new Vector3(0, fontSize * LABEL_OFFSET_ADJACENT_Y, 0));
        oppositeLabelPos
          .copy(oppositeMidpoint)
          .add(new Vector3(-fontSize * LABEL_OFFSET_OPPOSITE_X, 0, 0));
        hypotenuseLabelPos
          .copy(hypotenuseMidpoint)
          .add(new Vector3(0, -fontSize * LABEL_OFFSET_HYPOTENUSE_Y, 0));
        break;
      }

      case Q4: {
        // 270-360 degrees
        adjacentLabelPos
          .copy(adjacentMidpoint)
          .add(new Vector3(0, fontSize * LABEL_OFFSET_ADJACENT_Y, 0));
        oppositeLabelPos
          .copy(oppositeMidpoint)
          .add(new Vector3(fontSize * LABEL_OFFSET_OPPOSITE_X, 0, 0));
        hypotenuseLabelPos
          .copy(hypotenuseMidpoint)
          .add(new Vector3(0, -fontSize * LABEL_OFFSET_HYPOTENUSE_Y, 0));
        break;
      }

      default:
        break;
    }

    return { adjacentLabelPos, oppositeLabelPos, hypotenuseLabelPos };
  }, [quadrant, adjacent, opposite]);

  // Calculate hypotenuse rotation once
  const hypotenuseLabelRotation = useMemo(() => {
    switch (quadrant) {
      case Q1:
        return Math.atan2(opposite, adjacent);
      case Q2:
      case Q3:
        return Math.atan2(opposite, adjacent) + Math.PI;
      default:
        return Math.atan2(opposite, adjacent);
    }
  }, [quadrant, opposite, adjacent]);

  // Line colors and semantic keys for triangle sides
  const sideConfig = [
    { color: COLORS.CYAN, key: "adjacent" },
    { color: COLORS.ORANGE, key: "opposite" },
    { color: COLORS.ROSE, key: "hypotenuse" },
  ];

  return (
    <group frustumCulled {...props}>
      {/* Draw the triangle sides - optimized with single color array access */}
      {triangleSideLines.map((pts, i) => (
        <Line
          color={sideConfig[i].color}
          frustumCulled
          key={sideConfig[i].key}
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

      {/* Angle label */}
      <Text
        anchorX="center"
        anchorY="middle"
        color={COLORS.VIOLET}
        font={fontPath}
        fontSize={fontSize}
        frustumCulled={false}
        material-depthTest={false}
        position={[
          Math.cos(angleInRadians / 2) * angleLabelDistance +
            (angle > DEGREES_IN_HALF_CIRCLE ? -1 : 1) *
              fontSize *
              ANGLE_LABEL_POSITION_ADJUSTMENT,
          Math.sin(angleInRadians / 2) * angleLabelDistance,
          0,
        ]}
        renderOrder={10}
      >
        {`${angle}°`}
      </Text>

      {/* Side labels */}
      <Text
        anchorX="center"
        color={COLORS.CYAN}
        font={fontPath}
        fontSize={fontSize}
        frustumCulled={false}
        material-depthTest={false}
        position={labelPositions.adjacentLabelPos}
        renderOrder={10}
      >
        {labels.adjacent}
      </Text>

      <Text
        anchorY="middle"
        color={COLORS.ORANGE}
        font={fontPath}
        fontSize={fontSize}
        frustumCulled={false}
        material-depthTest={false}
        position={labelPositions.oppositeLabelPos}
        renderOrder={10}
      >
        {labels.opposite}
      </Text>

      <Text
        anchorX="center"
        anchorY="middle"
        color={COLORS.ROSE}
        font={fontPath}
        fontSize={fontSize}
        frustumCulled={false}
        material-depthTest={false}
        position={labelPositions.hypotenuseLabelPos}
        renderOrder={10}
        rotation={[0, 0, hypotenuseLabelRotation]}
      >
        {labels.hypotenuse}
      </Text>

      {/* Points at vertices - using instanced rendering */}
      <Instances
        count={triangleVertices.length}
        frustumCulled
        geometry={sphereGeo}
        material={sphereMat}
        visible
      >
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
