"use client";

import { COLORS } from "@/lib/utils/color";
import { Instance, Instances, Line, Text } from "@react-three/drei";
import { useTheme } from "next-themes";
import { useMemo } from "react";
import * as THREE from "three";
import { ORIGIN_COLOR } from "./_data";
import { FONT_PATH, MONO_FONT_PATH } from "./_data";

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
  const angleInRadians = (angle * Math.PI) / 180;

  // Identify which quadrant the angle is in
  const quadrant = (Math.floor(angle / 90) % 4) + 1;

  // Create a right triangle with sides of variable length based on the angle
  const hypotenuse = size; // Scale the hypotenuse by the size parameter
  const adjacent = Math.cos(angleInRadians) * hypotenuse;
  const opposite = Math.sin(angleInRadians) * hypotenuse;

  // Calculate midpoints for labels
  const adjacentMidpoint = new THREE.Vector3(adjacent / 2, 0, 0);
  const oppositeMidpoint = new THREE.Vector3(adjacent, opposite / 2, 0);
  const hypotenuseMidpoint = new THREE.Vector3(adjacent / 2, opposite / 2, 0);

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
    const origin = new THREE.Vector3(0, 0, 0);
    const adj = new THREE.Vector3(adjacent, 0, 0);
    const opp = new THREE.Vector3(adjacent, opposite, 0);
    return [
      [origin, adj],
      [adj, opp],
      [opp, origin],
    ];
  }, [adjacent, opposite]);

  // Memoize the angle arc points
  const triangleArcPoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 30; i++) {
      const a = (i / 30) * angleInRadians;
      pts.push(
        new THREE.Vector3(Math.cos(a) * arcRadius, Math.sin(a) * arcRadius, 0)
      );
    }
    return pts;
  }, [angleInRadians, arcRadius]);

  // Vertices for instancing
  const triangleVertices = useMemo(
    () => triangleSideLines.map((pts) => pts[0]),
    [triangleSideLines]
  );

  // Reuse sphere geometry and material for vertex markers
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(1, 16, 16), []);
  const sphereMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: baseColor }),
    [baseColor]
  );

  // Determine label positions based on quadrant and angle
  const adjacentLabelPos = new THREE.Vector3();
  const oppositeLabelPos = new THREE.Vector3();
  const hypotenuseLabelPos = new THREE.Vector3();

  // Position for right angle marker
  const rightAnglePos = new THREE.Vector3();

  // Combined switch statement for all label positions based on quadrant
  switch (quadrant) {
    case 1: // 0-90 degrees
      {
        // Adjacent and opposite label positions
        adjacentLabelPos
          .copy(adjacentMidpoint)
          .add(new THREE.Vector3(0, -fontSize * 1.5, 0));
        oppositeLabelPos
          .copy(oppositeMidpoint)
          .add(new THREE.Vector3(fontSize * 4, 0, 0));

        // Hypotenuse label position - place it outside the triangle
        hypotenuseLabelPos
          .copy(hypotenuseMidpoint)
          .add(new THREE.Vector3(0, fontSize * 2, 0));

        // Right angle marker at (adjacent, 0)
        rightAnglePos.set(adjacent, 0, 0);
      }
      break;

    case 2: // 90-180 degrees
      {
        // Adjacent and opposite label positions
        adjacentLabelPos
          .copy(adjacentMidpoint)
          .add(new THREE.Vector3(0, -fontSize * 1.5, 0));
        oppositeLabelPos
          .copy(oppositeMidpoint)
          .add(new THREE.Vector3(-fontSize * 4, 0, 0));
        hypotenuseLabelPos
          .copy(hypotenuseMidpoint)
          .add(new THREE.Vector3(0, fontSize * 2, 0));

        // Right angle marker at (0, 0)
        rightAnglePos.set(0, 0, 0);
      }
      break;

    case 3: // 180-270 degrees
      {
        // Adjacent and opposite label positions
        adjacentLabelPos
          .copy(adjacentMidpoint)
          .add(new THREE.Vector3(0, fontSize * 1.5, 0));
        oppositeLabelPos
          .copy(oppositeMidpoint)
          .add(new THREE.Vector3(-fontSize * 4, 0, 0));
        hypotenuseLabelPos
          .copy(hypotenuseMidpoint)
          .add(new THREE.Vector3(0, -fontSize * 2, 0));

        // Right angle marker at (0, 0)
        rightAnglePos.set(0, 0, 0);
      }
      break;

    case 4: // 270-360 degrees
      {
        // Adjacent and opposite label positions
        adjacentLabelPos
          .copy(adjacentMidpoint)
          .add(new THREE.Vector3(0, fontSize * 1.5, 0));
        oppositeLabelPos
          .copy(oppositeMidpoint)
          .add(new THREE.Vector3(fontSize * 4, 0, 0));
        hypotenuseLabelPos
          .copy(hypotenuseMidpoint)
          .add(new THREE.Vector3(0, -fontSize * 2, 0));

        // Right angle marker at (adjacent, 0)
        rightAnglePos.set(adjacent, 0, 0);
      }
      break;

    default:
      break;
  }

  return (
    <group {...props}>
      {/* Draw the triangle sides */}
      {triangleSideLines.map((pts, i) => (
        <Line
          key={i}
          points={pts}
          color={[COLORS.CYAN, COLORS.ORANGE, COLORS.ROSE][i]}
          lineWidth={2}
        />
      ))}

      {/* Angle arc */}
      <Line points={triangleArcPoints} color={COLORS.VIOLET} lineWidth={2} />

      {/* Angle label */}
      <Text
        position={[
          Math.cos(angleInRadians / 2) * angleLabelDistance +
            (angle > 180 ? -1 : 1) * fontSize * 0.5,
          Math.sin(angleInRadians / 2) * angleLabelDistance,
          0,
        ]}
        color={COLORS.VIOLET}
        fontSize={fontSize}
        font={fontPath}
      >
        {`${angle}°`}
      </Text>

      {/* Side labels */}
      <Text
        position={adjacentLabelPos}
        color={COLORS.CYAN}
        fontSize={fontSize}
        font={fontPath}
        anchorX="center"
      >
        {labels.adjacent}
      </Text>

      <Text
        position={oppositeLabelPos}
        color={COLORS.ORANGE}
        fontSize={fontSize}
        font={fontPath}
        anchorY="middle"
      >
        {labels.opposite}
      </Text>

      <Text
        position={hypotenuseLabelPos}
        color={COLORS.ROSE}
        fontSize={fontSize}
        font={fontPath}
        anchorX="center"
        anchorY="middle"
        rotation={[
          0,
          0,
          (() => {
            switch (quadrant) {
              case 1:
                return Math.atan2(opposite, adjacent);
              case 2:
                return Math.atan2(opposite, adjacent) + Math.PI;
              case 3:
                return Math.atan2(opposite, adjacent) + Math.PI;
              default:
                return Math.atan2(opposite, adjacent);
            }
          })(),
        ]}
      >
        {labels.hypotenuse}
      </Text>

      {/* Points at vertices */}
      <Instances
        visible
        geometry={sphereGeo}
        material={sphereMat}
        count={triangleVertices.length}
      >
        {triangleVertices.map((v, i) => (
          <Instance key={i} position={[v.x, v.y, v.z]} scale={vertexSize} />
        ))}
      </Instances>
    </group>
  );
}
