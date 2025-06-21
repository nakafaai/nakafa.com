"use client";

import { Instance, Instances, Line, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { randomColor } from "@repo/design-system/lib/color";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { FONT_PATH, MONO_FONT_PATH } from "./_data";

// Shared geometry cache
let sharedSphereGeometry: THREE.SphereGeometry | null = null;
const sharedConeGeometries = new Map<string, THREE.ConeGeometry>();
const sharedMaterials = new Map<string, THREE.MeshBasicMaterial>();

function getSharedSphereGeometry(): THREE.SphereGeometry {
  if (!sharedSphereGeometry) {
    // Reduced segments for better performance
    sharedSphereGeometry = new THREE.SphereGeometry(0.1, 8, 8);
  }
  return sharedSphereGeometry;
}

function getSharedConeGeometry(size: number): THREE.ConeGeometry {
  const key = `cone-${size}`;
  if (!sharedConeGeometries.has(key)) {
    // Reduced segments for better performance
    sharedConeGeometries.set(
      key,
      new THREE.ConeGeometry(size / 2, size, 16, 1)
    );
  }
  const geometry = sharedConeGeometries.get(key);
  if (!geometry) {
    throw new Error(`Cone geometry not found for size: ${size}`);
  }
  return geometry;
}

function getSharedMaterial(
  color: string | THREE.Color
): THREE.MeshBasicMaterial {
  const colorKey = color instanceof THREE.Color ? color.getHexString() : color;
  if (!sharedMaterials.has(colorKey)) {
    sharedMaterials.set(
      colorKey,
      new THREE.MeshBasicMaterial({
        color: color instanceof THREE.Color ? color : new THREE.Color(color),
      })
    );
  }
  const material = sharedMaterials.get(colorKey);
  if (!material) {
    throw new Error(`Material not found for color: ${colorKey}`);
  }
  return material;
}

export type Props = {
  points: {
    x: number;
    y: number;
    z: number;
  }[];
  color?: string | THREE.Color;
  lineWidth?: number;
  /**
   * Whether to use the mono font for the labels
   */
  useMonoFont?: boolean;
  showPoints?: boolean;
  /**
   * Whether to render the line as a smooth curve using CatmullRomCurve3
   */
  smooth?: boolean;
  /**
   * Number of points to use for the curve when smooth is true
   * Higher values will create a smoother curve but may impact performance
   */
  curvePoints?: number;
  /**
   * Optional array of labels to render along the line. Each can specify the index of the point
   * at which to render (defaults to midpoint), optional offset, and text styling.
   */
  labels?: Array<{
    /** Text to display */
    text: string;
    /** Optional index into the `points` array where this label should appear; defaults to midpoint */
    at?: number;
    /** Optional [x,y,z] offset applied on top of the base point position */
    offset?: [number, number, number];
    /** Color for the label text */
    color?: string | THREE.Color;
    /** Font size of the label text */
    fontSize?: number;
  }>;
  /**
   * Optional cone arrowhead configuration.
   */
  cone?: {
    /** Position of the cone arrowhead */
    position: "start" | "end" | "both";
    /** Size of the arrowhead */
    size?: number;
  };
};

export function LineEquation({
  points,
  color = randomColor(["YELLOW", "GREEN", "BLUE"]),
  lineWidth = 2,
  showPoints = true,
  smooth = true,
  curvePoints = 30, // Reduced default from 50 for better performance
  labels = [],
  useMonoFont = true,
  cone,
}: Props) {
  const groupRef = useRef<THREE.Group>(null);

  const vectorPoints = useMemo(
    () => points.map((point) => new THREE.Vector3(point.x, point.y, point.z)),
    [points]
  );

  // Define cone size (default to 0.5 if not provided in cone prop)
  const arrowSize = cone?.size ?? 0.5;

  // Generate smooth curve points if smooth is true
  const linePoints = useMemo(() => {
    if (vectorPoints.length < 2) {
      return vectorPoints;
    }

    let basePoints: THREE.Vector3[];

    if (smooth) {
      // Use CatmullRomCurve3 for smooth curves
      const curve = new THREE.CatmullRomCurve3(vectorPoints);
      basePoints = curve.getPoints(curvePoints);
    } else {
      // For non-smooth lines, use the original points directly
      basePoints = [...vectorPoints];
    }

    // Adjust line end points to account for the cone size to prevent overlap
    if (cone) {
      if (
        (cone.position === "start" || cone.position === "both") &&
        basePoints.length >= 2
      ) {
        const startPoint = basePoints[0];
        const nextPoint = basePoints[1];
        const direction = new THREE.Vector3()
          .subVectors(nextPoint, startPoint)
          .normalize();
        basePoints[0] = startPoint
          .clone()
          .add(direction.multiplyScalar(arrowSize)); // Move start point forward
      }

      if (
        (cone.position === "end" || cone.position === "both") &&
        basePoints.length >= 2
      ) {
        const endPoint = basePoints.at(-1);
        const prevPoint = basePoints.at(-2);
        // Ensure points exist
        if (!endPoint || !prevPoint) {
          return basePoints; // Return unmodified points if check fails
        }

        const direction = new THREE.Vector3()
          .subVectors(endPoint, prevPoint)
          .normalize();
        // Find the index of the last point to modify it directly
        const lastIndex = basePoints.length - 1;
        basePoints[lastIndex] = endPoint
          .clone()
          .sub(direction.multiplyScalar(arrowSize)); // Move end point backward
      }
    }
    return basePoints;
  }, [vectorPoints, smooth, curvePoints, cone, arrowSize]);

  const fontPath = useMonoFont ? MONO_FONT_PATH : FONT_PATH;

  // Use shared geometry and materials
  const pointGeom = getSharedSphereGeometry();
  const pointMat = getSharedMaterial(color);

  // Cone geometry and material (reused from ArrowHelper logic)
  const coneGeometry = useMemo(
    () => (cone ? getSharedConeGeometry(arrowSize) : null),
    [cone, arrowSize]
  );
  const coneMaterial = useMemo(
    () => (cone ? getSharedMaterial(color) : null),
    [cone, color]
  );

  // Calculate cone position and orientation
  const coneData = useMemo(() => {
    if (!cone || vectorPoints.length < 2) {
      return null;
    }

    const cones: { position: THREE.Vector3; quaternion: THREE.Quaternion }[] =
      [];

    // Add start cone if position is "start" or "both"
    if (cone.position === "start" || cone.position === "both") {
      const targetPoint = vectorPoints[0];
      const nextPoint = vectorPoints[1];
      // Ensure points exist (should always be true here due to length check)
      if (targetPoint && nextPoint) {
        const direction = new THREE.Vector3()
          .subVectors(nextPoint, targetPoint)
          .normalize();
        // For start cone: position it so its tip is at the original start point
        // The cone points backwards (opposite to line direction)
        const conePosition = new THREE.Vector3()
          .copy(targetPoint)
          .add(direction.clone().multiplyScalar(arrowSize / 2));
        const quaternion = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          direction.clone().negate()
        );
        cones.push({ position: conePosition, quaternion });
      }
    }

    // Add end cone if position is "end" or "both"
    if (cone.position === "end" || cone.position === "both") {
      const targetPoint = vectorPoints.at(-1);
      const prevPoint = vectorPoints.at(-2);

      // Ensure both points exist before proceeding
      if (targetPoint && prevPoint) {
        const direction = new THREE.Vector3()
          .subVectors(targetPoint, prevPoint)
          .normalize();
        const conePosition = new THREE.Vector3()
          .copy(targetPoint)
          .sub(direction.clone().multiplyScalar(arrowSize / 2));
        const quaternion = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          direction
        );
        cones.push({ position: conePosition, quaternion });
      }
    }

    return cones.length > 0 ? cones : null;
  }, [cone, vectorPoints, arrowSize]);

  // Enable frustum culling for the entire group
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.frustumCulled = true;
    }
  });

  // Pre-calculate label data to avoid recreating in render
  const labelData = useMemo(() => {
    return labels
      .map((label, idx) => {
        const mid = Math.floor(vectorPoints.length / 2);
        const index = label.at ?? mid;
        const base = vectorPoints[index];
        if (!base) {
          return null;
        }
        const [ox = 0, oy = 0, oz = 0] = label.offset || [0, 0, 0];
        const pos: [number, number, number] = [
          base.x + ox,
          base.y + oy,
          base.z + oz,
        ];
        return {
          key: `label-${idx}`,
          position: pos,
          color: label.color ?? color,
          fontSize: label.fontSize ?? 0.5,
          text: label.text,
        };
      })
      .filter(Boolean);
  }, [labels, vectorPoints, color]);

  return (
    <group ref={groupRef}>
      {/* Draw a line connecting the provided points */}
      <Line
        points={linePoints}
        color={color}
        lineWidth={lineWidth}
        frustumCulled
      />

      {/* Render the cone(s) if configured */}
      {coneData &&
        coneGeometry &&
        coneMaterial &&
        coneData.map((data, index) => (
          <mesh
            key={`cone-${index}`}
            geometry={coneGeometry}
            material={coneMaterial}
            position={data.position}
            quaternion={data.quaternion}
            frustumCulled
          />
        ))}

      {/* Optionally render a small sphere at each point */}
      <Instances
        visible={showPoints}
        geometry={pointGeom}
        material={pointMat}
        count={vectorPoints.length}
        frustumCulled
      >
        {vectorPoints.map((v, i) => (
          <Instance key={i} position={[v.x, v.y, v.z]} />
        ))}
      </Instances>

      {/* Render custom labels at specified indices */}
      {labelData.map((data) => {
        if (!data) {
          return null;
        }
        return (
          <Text
            key={data.key}
            position={data.position}
            color={data.color}
            fontSize={data.fontSize}
            anchorX="center"
            anchorY="middle"
            font={fontPath}
            frustumCulled
          >
            {data.text}
          </Text>
        );
      })}
    </group>
  );
}
