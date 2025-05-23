"use client";

import { randomColor } from "@/lib/utils/color";
import { Instance, Instances, Line, Text } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
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
    position: "start" | "end";
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

    // Get start and end points safely
    const startPoint = vectorPoints[0];
    const endPoint = vectorPoints.at(-1);

    // This check satisfies TS, even though endPoint is guaranteed by the length check above
    if (!endPoint) {
      return vectorPoints; // Should be unreachable
    }

    const curve = smooth
      ? new THREE.CatmullRomCurve3(vectorPoints)
      : new THREE.LineCurve3(startPoint, endPoint);

    const basePoints = smooth
      ? curve.getPoints(curvePoints)
      : curve.getPoints(1); // Get fewer points if not smooth

    // Adjust line end points to account for the cone size to prevent overlap
    if (cone) {
      if (cone.position === "start" && basePoints.length >= 2) {
        const startPoint = basePoints[0];
        const nextPoint = basePoints[1];
        const direction = new THREE.Vector3()
          .subVectors(nextPoint, startPoint)
          .normalize();
        basePoints[0] = startPoint.add(direction.multiplyScalar(arrowSize)); // Move start point forward
      } else if (cone.position === "end" && basePoints.length >= 2) {
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
        basePoints[lastIndex] = endPoint.sub(
          direction.multiplyScalar(arrowSize)
        ); // Move end point backward
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

    let targetPoint: THREE.Vector3 | undefined;
    let direction: THREE.Vector3;
    let conePosition: THREE.Vector3;
    let quaternion: THREE.Quaternion;

    if (cone.position === "start") {
      targetPoint = vectorPoints[0];
      const nextPoint = vectorPoints[1];
      // Ensure points exist (should always be true here due to length check)
      if (!targetPoint || !nextPoint) {
        return null;
      }

      direction = new THREE.Vector3()
        .subVectors(nextPoint, targetPoint)
        .normalize();
      conePosition = new THREE.Vector3()
        .copy(targetPoint)
        .sub(direction.clone().multiplyScalar(arrowSize / 2));
      quaternion = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.clone().negate()
      );
    } else {
      // Default to 'end'
      targetPoint = vectorPoints.at(-1);
      const prevPoint = vectorPoints.at(-2);

      // Ensure both points exist before proceeding
      if (!targetPoint || !prevPoint) {
        return null; // Should not happen due to initial length check, but satisfies TypeScript
      }

      direction = new THREE.Vector3()
        .subVectors(targetPoint, prevPoint)
        .normalize();
      conePosition = new THREE.Vector3()
        .copy(targetPoint)
        .sub(direction.clone().multiplyScalar(arrowSize / 2));
      quaternion = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction
      );
    }

    return { position: conePosition, quaternion };
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

      {/* Render the cone if configured */}
      {coneData && coneGeometry && coneMaterial && (
        <mesh
          geometry={coneGeometry}
          material={coneMaterial}
          position={coneData.position}
          quaternion={coneData.quaternion}
          frustumCulled
        />
      )}

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
