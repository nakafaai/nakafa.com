"use client";

import { Instance, Instances, Line, Text } from "@react-three/drei";
import { randomColor } from "@repo/design-system/lib/color";
import { useMemo } from "react";
import {
  CatmullRomCurve3,
  Color,
  ConeGeometry,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { FONT_PATH, MONO_FONT_PATH } from "./_data";
import {
  GRAPH_ARROW_SEGMENTS,
  GRAPH_POINT_SEGMENTS,
  getCurveDivisions,
} from "./quality";

const SPHERE_GEOMETRY_RADIUS = 0.1;
const CONE_GEOMETRY_HEIGHT_SEGMENTS = 1;
const DEFAULT_ARROW_SIZE = 0.5;
const DEFAULT_FONT_SIZE = 0.5;

// Shared geometry cache
let sharedSphereGeometry: SphereGeometry | null = null;
const sharedConeGeometries = new Map<string, ConeGeometry>();
const sharedMaterials = new Map<string, MeshBasicMaterial>();

/**
 * Reuses point marker geometry across all rendered line equations.
 *
 * @see https://r3f.docs.pmnd.rs/advanced/scaling-performance#re-using-geometries-and-materials
 */
function getSharedSphereGeometry(): SphereGeometry {
  if (!sharedSphereGeometry) {
    sharedSphereGeometry = new SphereGeometry(
      SPHERE_GEOMETRY_RADIUS,
      GRAPH_POINT_SEGMENTS,
      GRAPH_POINT_SEGMENTS
    );
  }
  return sharedSphereGeometry;
}

/**
 * Reuses arrowhead geometry per size for line equation direction markers.
 *
 * @see https://r3f.docs.pmnd.rs/advanced/scaling-performance#re-using-geometries-and-materials
 */
function getSharedConeGeometry(size: number): ConeGeometry {
  const key = `cone-${size}`;
  if (!sharedConeGeometries.has(key)) {
    sharedConeGeometries.set(
      key,
      new ConeGeometry(
        size / 2,
        size,
        GRAPH_ARROW_SEGMENTS,
        CONE_GEOMETRY_HEIGHT_SEGMENTS
      )
    );
  }
  const geometry = sharedConeGeometries.get(key);
  if (!geometry) {
    throw new Error(`Cone geometry not found for size: ${size}`);
  }
  return geometry;
}

/**
 * Reuses line equation materials by color to avoid repeated material setup.
 *
 * @see https://r3f.docs.pmnd.rs/advanced/scaling-performance#re-using-geometries-and-materials
 */
function getSharedMaterial(color: string | Color): MeshBasicMaterial {
  const colorKey = color instanceof Color ? color.getHexString() : color;
  if (!sharedMaterials.has(colorKey)) {
    sharedMaterials.set(
      colorKey,
      new MeshBasicMaterial({
        color: color instanceof Color ? color : new Color(color),
      })
    );
  }
  const material = sharedMaterials.get(colorKey);
  if (!material) {
    throw new Error(`Material not found for color: ${colorKey}`);
  }
  return material;
}

export interface Props {
  color?: string | Color;
  /**
   * Optional cone arrowhead configuration.
   */
  cone?: {
    /** Position of the cone arrowhead */
    position: "start" | "end" | "both";
    /** Size of the arrowhead */
    size?: number;
  };
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
    color?: string | Color;
    /** Font size of the label text */
    fontSize?: number;
  }>;
  lineWidth?: number;
  points: {
    x: number;
    y: number;
    z: number;
  }[];
  showPoints?: boolean;
  /**
   * Whether to render the line as a smooth curve using CatmullRomCurve3
   */
  smooth?: boolean;
  /**
   * Whether to use the mono font for the labels
   */
  useMonoFont?: boolean;
}

/**
 * Renders a 3D line or curve with optional point markers, labels, and arrowheads.
 */
export function LineEquation({
  points,
  color = randomColor(["YELLOW", "GREEN", "BLUE"]),
  lineWidth = 2,
  showPoints = true,
  smooth = true,
  curvePoints,
  labels = [],
  useMonoFont = true,
  cone,
}: Props) {
  const vectorPoints = useMemo(
    () => points.map((point) => new Vector3(point.x, point.y, point.z)),
    [points]
  );

  // Define cone size (default to 0.5 if not provided in cone prop)
  const arrowSize = cone?.size ?? DEFAULT_ARROW_SIZE;

  // Generate smooth curve points if smooth is true
  const linePoints = useMemo(() => {
    if (vectorPoints.length < 2) {
      return vectorPoints;
    }

    let basePoints = [...vectorPoints];

    if (smooth && vectorPoints.length > 2) {
      const curve = new CatmullRomCurve3(vectorPoints);
      const divisions = getCurveDivisions(vectorPoints.length, curvePoints);
      basePoints = curve.getPoints(divisions);
    }

    // Adjust line end points to account for the cone size to prevent overlap
    if (cone) {
      if (
        (cone.position === "start" || cone.position === "both") &&
        basePoints.length >= 2
      ) {
        const startPoint = basePoints[0];
        const nextPoint = basePoints[1];
        const direction = new Vector3()
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
        if (!(endPoint && prevPoint)) {
          return basePoints; // Return unmodified points if check fails
        }

        const direction = new Vector3()
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

    const cones: { position: Vector3; quaternion: Quaternion }[] = [];

    // Add start cone if position is "start" or "both"
    if (cone.position === "start" || cone.position === "both") {
      const targetPoint = vectorPoints[0];
      const nextPoint = vectorPoints[1];
      // Ensure points exist (should always be true here due to length check)
      if (targetPoint && nextPoint) {
        const direction = new Vector3()
          .subVectors(nextPoint, targetPoint)
          .normalize();
        // For start cone: position it so its tip is at the original start point
        // The cone points backwards (opposite to line direction)
        const conePosition = new Vector3()
          .copy(targetPoint)
          .add(direction.clone().multiplyScalar(arrowSize / 2));
        const quaternion = new Quaternion().setFromUnitVectors(
          new Vector3(0, 1, 0),
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
        const direction = new Vector3()
          .subVectors(targetPoint, prevPoint)
          .normalize();
        const conePosition = new Vector3()
          .copy(targetPoint)
          .sub(direction.clone().multiplyScalar(arrowSize / 2));
        const quaternion = new Quaternion().setFromUnitVectors(
          new Vector3(0, 1, 0),
          direction
        );
        cones.push({ position: conePosition, quaternion });
      }
    }

    return cones.length > 0 ? cones : null;
  }, [cone, vectorPoints, arrowSize]);

  // Pre-calculate label data to avoid recreating in render
  const labelData = useMemo(
    () =>
      labels.flatMap((label, idx) => {
        const mid = Math.floor(vectorPoints.length / 2);
        const index = label.at ?? mid;
        const base = vectorPoints[index];
        if (!base) {
          return [];
        }

        const [ox = 0, oy = 0, oz = 0] = label.offset || [0, 0, 0];
        const position = new Vector3(base.x + ox, base.y + oy, base.z + oz);

        return [
          {
            key: `label-${idx}`,
            position,
            color: label.color ?? color,
            fontSize: label.fontSize ?? DEFAULT_FONT_SIZE,
            text: label.text,
          },
        ];
      }),
    [labels, vectorPoints, color]
  );

  return (
    <group frustumCulled>
      {/* Draw a line connecting the provided points */}
      <Line
        color={color}
        frustumCulled
        lineWidth={lineWidth}
        points={linePoints}
      />

      {/* Render the cone(s) if configured */}
      {!!coneData &&
        !!coneGeometry &&
        !!coneMaterial &&
        coneData.map((data) => (
          <mesh
            frustumCulled
            geometry={coneGeometry}
            key={`cone-${data.position.x}-${data.position.y}-${data.position.z}`}
            material={coneMaterial}
            position={data.position}
            quaternion={data.quaternion}
          />
        ))}

      {/* Optionally render a small sphere at each point */}
      <Instances
        count={vectorPoints.length}
        frustumCulled
        geometry={pointGeom}
        material={pointMat}
        visible={showPoints}
      >
        {vectorPoints.map((v, index) => (
          <Instance
            // biome-ignore lint/suspicious/noArrayIndexKey: Coordinates may appear multiple times, need index for uniqueness
            key={`point-${index}-${v.x}-${v.y}-${v.z}`}
            position={[v.x, v.y, v.z]}
          />
        ))}
      </Instances>

      {/* Render custom labels at specified indices */}
      {labelData.map((data) => (
        <Text
          anchorX="center"
          anchorY="middle"
          color={data.color}
          font={fontPath}
          fontSize={data.fontSize}
          frustumCulled={false}
          key={data.key}
          material-depthTest={false}
          position={data.position}
          renderOrder={10}
        >
          {data.text}
        </Text>
      ))}
    </group>
  );
}
