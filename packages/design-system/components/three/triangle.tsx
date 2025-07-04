"use client";

import { Instance, Instances, Line, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { COLORS } from "@repo/design-system/lib/color";
import { useTheme } from "next-themes";
import { useMemo, useRef } from "react";
import { type Group, MeshBasicMaterial, SphereGeometry, Vector3 } from "three";
import { FONT_PATH, MONO_FONT_PATH, ORIGIN_COLOR } from "./_data";

// Pre-calculate common values
const SPHERE_SEGMENTS = 8; // Reduced from 16
const ARC_SEGMENTS = 20; // Reduced from 30

type Props = {
  /** Angle in degrees */
  angle?: number;
  /** Size of the triangle (scale factor) */
  size?: number;
  /** Labels for the triangle */
  labels?: {
    opposite: string;
    adjacent: string;
    hypotenuse: string;
  };
  /** Use mono font for the labels */
  useMonoFont?: boolean;
  /** Additional props */
  [key: string]: unknown;
};

// Singleton geometry instances for reuse
let sharedSphereGeometry: SphereGeometry | null = null;
const sharedMaterials: Map<string, MeshBasicMaterial> = new Map();

function getSharedSphereGeometry() {
  if (!sharedSphereGeometry) {
    sharedSphereGeometry = new SphereGeometry(
      1,
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
  const groupRef = useRef<Group>(null);

  // Convert angle to radians and calculate the points
  const angleInRadians = (angle * Math.PI) / 180;

  // Identify which quadrant the angle is in
  const quadrant = (Math.floor(angle / 90) % 4) + 1;

  // Create a right triangle with sides of variable length based on the angle
  const hypotenuse = size; // Scale the hypotenuse by the size parameter
  const adjacent = Math.cos(angleInRadians) * hypotenuse;
  const opposite = Math.sin(angleInRadians) * hypotenuse;

  // Font path based on the useMonoFont setting
  const fontPath = useMonoFont ? MONO_FONT_PATH : FONT_PATH;

  // Scale the font size based on the triangle size
  const fontSize = 0.12 * Math.max(1, size * 0.12);

  // Colors based on theme
  const baseColor =
    resolvedTheme === "dark" ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK;

  // Scale the vertex points based on triangle size
  const vertexSize = 0.05 * Math.max(1, size * 0.05);

  // Scale the angle arc radius based on triangle size - make it more proportional
  const arcRadius = 0.2 * Math.sqrt(size);
  const angleLabelDistance = 0.3 * Math.sqrt(size);

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

  // Memoize the angle arc points with fewer segments for performance
  const triangleArcPoints = useMemo(() => {
    const pts: Vector3[] = [];
    for (let i = 0; i <= ARC_SEGMENTS; i++) {
      const a = (i / ARC_SEGMENTS) * angleInRadians;
      pts.push(
        new Vector3(Math.cos(a) * arcRadius, Math.sin(a) * arcRadius, 0)
      );
    }
    return pts;
  }, [angleInRadians, arcRadius]);

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
      case 1: {
        // 0-90 degrees
        adjacentLabelPos
          .copy(adjacentMidpoint)
          .add(new Vector3(0, -fontSize * 1.5, 0));
        oppositeLabelPos
          .copy(oppositeMidpoint)
          .add(new Vector3(fontSize * 4, 0, 0));
        hypotenuseLabelPos
          .copy(hypotenuseMidpoint)
          .add(new Vector3(0, fontSize * 2, 0));
        break;
      }

      case 2: {
        // 90-180 degrees
        adjacentLabelPos
          .copy(adjacentMidpoint)
          .add(new Vector3(0, -fontSize * 1.5, 0));
        oppositeLabelPos
          .copy(oppositeMidpoint)
          .add(new Vector3(-fontSize * 4, 0, 0));
        hypotenuseLabelPos
          .copy(hypotenuseMidpoint)
          .add(new Vector3(0, fontSize * 2, 0));
        break;
      }

      case 3: {
        // 180-270 degrees
        adjacentLabelPos
          .copy(adjacentMidpoint)
          .add(new Vector3(0, fontSize * 1.5, 0));
        oppositeLabelPos
          .copy(oppositeMidpoint)
          .add(new Vector3(-fontSize * 4, 0, 0));
        hypotenuseLabelPos
          .copy(hypotenuseMidpoint)
          .add(new Vector3(0, -fontSize * 2, 0));
        break;
      }

      case 4: {
        // 270-360 degrees
        adjacentLabelPos
          .copy(adjacentMidpoint)
          .add(new Vector3(0, fontSize * 1.5, 0));
        oppositeLabelPos
          .copy(oppositeMidpoint)
          .add(new Vector3(fontSize * 4, 0, 0));
        hypotenuseLabelPos
          .copy(hypotenuseMidpoint)
          .add(new Vector3(0, -fontSize * 2, 0));
        break;
      }

      default:
        break;
    }

    return { adjacentLabelPos, oppositeLabelPos, hypotenuseLabelPos };
  }, [quadrant, adjacent, opposite, fontSize]);

  // Calculate hypotenuse rotation once
  const hypotenuseLabelRotation = useMemo(() => {
    switch (quadrant) {
      case 1:
        return Math.atan2(opposite, adjacent);
      case 2:
      case 3:
        return Math.atan2(opposite, adjacent) + Math.PI;
      default:
        return Math.atan2(opposite, adjacent);
    }
  }, [quadrant, opposite, adjacent]);

  // Use frustum culling
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.frustumCulled = true;
    }
  });

  // Line colors and semantic keys for triangle sides
  const sideConfig = [
    { color: COLORS.CYAN, key: "adjacent" },
    { color: COLORS.ORANGE, key: "opposite" },
    { color: COLORS.ROSE, key: "hypotenuse" },
  ];

  return (
    <group ref={groupRef} {...props}>
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
        frustumCulled
        position={[
          Math.cos(angleInRadians / 2) * angleLabelDistance +
            (angle > 180 ? -1 : 1) * fontSize * 0.5,
          Math.sin(angleInRadians / 2) * angleLabelDistance,
          0,
        ]}
      >
        {`${angle}°`}
      </Text>

      {/* Side labels */}
      <Text
        anchorX="center"
        color={COLORS.CYAN}
        font={fontPath}
        fontSize={fontSize}
        frustumCulled
        position={labelPositions.adjacentLabelPos}
      >
        {labels.adjacent}
      </Text>

      <Text
        anchorY="middle"
        color={COLORS.ORANGE}
        font={fontPath}
        fontSize={fontSize}
        frustumCulled
        position={labelPositions.oppositeLabelPos}
      >
        {labels.opposite}
      </Text>

      <Text
        anchorX="center"
        anchorY="middle"
        color={COLORS.ROSE}
        font={fontPath}
        fontSize={fontSize}
        frustumCulled
        position={labelPositions.hypotenuseLabelPos}
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
