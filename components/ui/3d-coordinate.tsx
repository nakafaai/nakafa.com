"use client";

import { cn } from "@/lib/utils";
import {
  GizmoHelper,
  GizmoViewport,
  Grid,
  Line,
  OrbitControls,
  PerspectiveCamera,
  Text,
} from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Grid2X2XIcon, PauseIcon, PlayIcon } from "lucide-react";
import { Grid2x2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import dynamic from "next/dynamic";
import { type ReactNode, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Button } from "./button";

const COLORS = {
  RED: "#dc2626",
  ORANGE: "#ea580c",
  EMBER: "#d97706",
  YELLOW: "#ca8a04",
  LIME: "#65a30d",
  GREEN: "#16a34a",
  EMERALD: "#059669",
  TEAL: "#0d9488",
  CYAN: "#0891b2",
  SKY: "#0284c7",
  BLUE: "#2563eb",
  INDIGO: "#4f46e5",
  VIOLET: "#7c3aed",
  PURPLE: "#9333ea",
  FUCHSIA: "#c026d3",
  PINK: "#db2777",
  ROSE: "#e11d48",
};
// origin point O(0, 0, 0)
const ORIGIN_COLOR = {
  LIGHT: "#f4f4f5",
  DARK: "#18181b",
};

// Font path for the 3D text
const FONT_PATH = "/fonts/Geist-Regular.ttf";
const MONO_FONT_PATH = "/fonts/GeistMono-Regular.ttf";

// --------------------------------
// Types
// --------------------------------

/**
 * Props for the 3D coordinate system component
 */
type CoordinateSystemProps = {
  /** Show the grid planes */
  showGrid?: boolean;
  /** Show the coordinate axes */
  showAxes?: boolean;
  /** Show the z-axis */
  showZAxis?: boolean;
  /** Show the origin point */
  showOrigin?: boolean;
  /** Show axis labels */
  showLabels?: boolean;
  /** Show the gizmo helper for orientation */
  showGizmo?: boolean;
  /** Size of the grid */
  gridSize?: number;
  /** Divisions of the grid */
  gridDivisions?: number;
  /** Size of the coordinate system */
  size?: number;
  /** Background color of the canvas */
  backgroundColor?: string;
  /** Custom camera position */
  cameraPosition?: [number, number, number];
  /** Font to use for labels and text
   *
   * @default "mono"
   */
  font?: "mono" | "sans";
  /** Children elements to render inside the coordinate system */
  children?: ReactNode;
  /** Additional class name */
  className?: string;
};

/**
 * Props for the Vector component
 */
type VectorProps = {
  /** Starting point of the vector [x, y, z] */
  from?: [number, number, number];
  /** End point of the vector [x, y, z] */
  to: [number, number, number];
  /** Color of the vector */
  color?: string | THREE.Color;
  /** Width of the vector line */
  lineWidth?: number;
  /** Show arrowhead */
  showArrow?: boolean;
  /** Size of the arrowhead */
  arrowSize?: number;
  /** Label for the vector */
  label?: string;
  /** Position of the label */
  labelPosition?: "start" | "middle" | "end";
  /** Use mono font for the label */
  useMonoFont?: boolean;
  /** Additional props */
  [key: string]: unknown;
};

type TriangleProps = {
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

/**
 * Props for the UnitCircle component
 */
type UnitCircleProps = {
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

/**
 * Props for the Function3D component
 */
type Function3DProps = {
  /** Function to plot z = f(x, y) */
  fn: (x: number, y: number) => number;
  /** Color of the function plot */
  color?: string | THREE.Color;
  /** Range for x axis [start, end] */
  xRange?: [number, number];
  /** Range for y axis [start, end] */
  yRange?: [number, number];
  /** Resolution/density of points */
  resolution?: number;
  /** Render as wireframe */
  wireframe?: boolean;
  /** Additional props */
  [key: string]: unknown;
};

/**
 * Props for the Function2D component
 */
type Function2DProps = {
  /** Function to plot y = f(x) */
  fn: (x: number) => number;
  /** Which plane to plot on: 'xy', 'xz', or 'yz' */
  plane?: "xy" | "xz" | "yz";
  /** Color of the function plot */
  color?: string | THREE.Color;
  /** Range for independent variable [start, end] */
  range?: [number, number];
  /** Resolution/density of points */
  resolution?: number;
  /** Width of the line */
  lineWidth?: number;
  /** Additional props */
  [key: string]: unknown;
};

// --------------------------------
// Helper Components
// --------------------------------

/**
 * Axes component for showing x, y, z axes
 */
export function Axes({
  size = 10,
  showLabels = true,
  showZAxis = true,
  labelSize = 0.5,
  labelOffset = 0.5,
  font = "mono",
}: {
  size?: number;
  showLabels?: boolean;
  showZAxis?: boolean;
  labelSize?: number;
  labelOffset?: number;
  font?: CoordinateSystemProps["font"];
}) {
  // Create points for each axis (now extending in both positive and negative directions)
  const xPoints = useMemo(
    () => [new THREE.Vector3(-size, 0, 0), new THREE.Vector3(size, 0, 0)],
    [size]
  );

  const yPoints = useMemo(
    () => [new THREE.Vector3(0, -size, 0), new THREE.Vector3(0, size, 0)],
    [size]
  );

  const zPoints = useMemo(
    () => [new THREE.Vector3(0, 0, -size), new THREE.Vector3(0, 0, size)],
    [size]
  );

  const fontToUse = font === "mono" ? MONO_FONT_PATH : FONT_PATH;

  return (
    <group>
      <Line points={xPoints} color={COLORS.RED} lineWidth={2} />
      <Line points={yPoints} color={COLORS.GREEN} lineWidth={2} />
      {showZAxis && <Line points={zPoints} color={COLORS.BLUE} lineWidth={2} />}

      {showLabels && (
        <>
          <Text
            position={[size + labelOffset, 0, 0]}
            color={COLORS.RED}
            fontSize={labelSize}
            anchorX="left"
            font={fontToUse}
          >
            X
          </Text>
          <Text
            position={[-size - labelOffset, 0, 0]}
            color={COLORS.RED}
            fontSize={labelSize}
            anchorX="right"
            font={fontToUse}
          >
            -X
          </Text>
          <Text
            position={[0, size + labelOffset, 0]}
            color={COLORS.GREEN}
            fontSize={labelSize}
            anchorX="left"
            font={fontToUse}
          >
            Y
          </Text>
          <Text
            position={[0, -size - labelOffset, 0]}
            color={COLORS.GREEN}
            fontSize={labelSize}
            anchorX="left"
            font={fontToUse}
          >
            -Y
          </Text>
          {showZAxis && (
            <>
              <Text
                position={[0, 0, size + labelOffset]}
                color={COLORS.BLUE}
                fontSize={labelSize}
                anchorX="left"
                font={fontToUse}
              >
                Z
              </Text>
              <Text
                position={[0, 0, -size - labelOffset]}
                color={COLORS.BLUE}
                fontSize={labelSize}
                anchorX="left"
                font={fontToUse}
              >
                -Z
              </Text>
            </>
          )}
        </>
      )}
    </group>
  );
}

/**
 * Origin component that marks the (0,0,0) point
 */
export function Origin({
  size = 0.2,
  color = ORIGIN_COLOR.LIGHT,
}: { size?: number; color?: string }) {
  return (
    <mesh>
      <sphereGeometry args={[size, 16, 16]} />
      <meshBasicMaterial color={color} />
    </mesh>
  );
}

/**
 * ArrowHelper component for creating vectors with arrowheads
 */
export function ArrowHelper({
  from = [0, 0, 0],
  to,
  color = COLORS.YELLOW,
  arrowSize = 0.5,
  label,
  labelPosition = "end",
  font = "mono",
}: VectorProps) {
  const vectors = useMemo(() => {
    const fromVec = new THREE.Vector3(...from);
    const toVec = new THREE.Vector3(...to);
    const direction = new THREE.Vector3()
      .subVectors(toVec, fromVec)
      .normalize();
    const length = fromVec.distanceTo(toVec);
    return { fromVec, toVec, direction, length };
  }, [from, to]);

  const midPoint = new THREE.Vector3().addVectors(
    vectors.fromVec,
    new THREE.Vector3()
      .copy(vectors.direction)
      .multiplyScalar(vectors.length / 2)
  );

  const endPoint = new THREE.Vector3().copy(vectors.toVec);

  let labelPos: THREE.Vector3;
  if (labelPosition === "start") {
    labelPos = new THREE.Vector3().copy(vectors.fromVec);
  } else if (labelPosition === "middle") {
    labelPos = midPoint;
  } else {
    // Default to "end"
    labelPos = new THREE.Vector3()
      .copy(endPoint)
      .add(new THREE.Vector3(0.2, 0.2, 0.2));
  }

  // Use a higher segment count for smoother cone
  const coneGeometry = useMemo(
    () => new THREE.ConeGeometry(arrowSize / 2, arrowSize, 32, 1),
    [arrowSize]
  );

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: color instanceof THREE.Color ? color : new THREE.Color(color),
      }),
    [color]
  );

  // Define the shaft points - from the start point to just before the cone
  const points = useMemo(
    () => [
      new THREE.Vector3(...from),
      new THREE.Vector3(
        vectors.toVec.x - vectors.direction.x * arrowSize,
        vectors.toVec.y - vectors.direction.y * arrowSize,
        vectors.toVec.z - vectors.direction.z * arrowSize
      ),
    ],
    [from, vectors.toVec, vectors.direction, arrowSize]
  );

  const fontToUse = font === "mono" ? MONO_FONT_PATH : FONT_PATH;

  return (
    <group>
      {/* Shaft of the arrow */}
      <Line points={points} color={color} lineWidth={2} />

      {/* Cone arrowhead with smooth segments */}
      <mesh
        geometry={coneGeometry}
        material={material}
        position={[
          vectors.toVec.x - (vectors.direction.x * arrowSize) / 2,
          vectors.toVec.y - (vectors.direction.y * arrowSize) / 2,
          vectors.toVec.z - (vectors.direction.z * arrowSize) / 2,
        ]}
        quaternion={new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          vectors.direction
        )}
      />

      {label && (
        <Text
          position={[labelPos.x, labelPos.y, labelPos.z]}
          color={color instanceof THREE.Color ? color.getStyle() : color}
          fontSize={0.5}
          anchorX="left"
          font={fontToUse}
        >
          {label}
        </Text>
      )}
    </group>
  );
}

/**
 * Camera controls and setup component
 */
export function CameraControls({
  cameraPosition = [12, 8, 12],
  autoRotate = true,
}: {
  cameraPosition?: [number, number, number];
  autoRotate?: boolean;
}) {
  return (
    <>
      <PerspectiveCamera makeDefault position={cameraPosition} fov={50} />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        autoRotate={autoRotate}
        autoRotateSpeed={0.5}
        minDistance={1}
        maxDistance={100}
        zoomSpeed={1.25}
        enableZoom={true}
        screenSpacePanning={true}
      />
    </>
  );
}

/**
 * Function3D component for plotting 3D surfaces
 */
export function Function3D({
  fn,
  color = COLORS.PINK,
  xRange = [-5, 5],
  yRange = [-5, 5],
  resolution = 50,
  wireframe = false,
  ...props
}: Function3DProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Create points for the mesh using a PlaneGeometry as base
  const geometry = useMemo(() => {
    const [xMin, xMax] = xRange;
    const [yMin, yMax] = yRange;

    // Create a plane geometry
    const planeGeometry = new THREE.PlaneGeometry(
      xMax - xMin,
      yMax - yMin,
      resolution,
      resolution
    );

    // Update vertices to reflect the function
    const positionAttribute = planeGeometry.getAttribute("position");
    const vertex = new THREE.Vector3();

    for (let i = 0; i < positionAttribute.count; i++) {
      vertex.fromBufferAttribute(positionAttribute, i);

      // Map from local plane space to our desired x,y range
      const x =
        xMin + ((vertex.x + (xMax - xMin) / 2) / (xMax - xMin)) * (xMax - xMin);
      const y =
        yMin + ((vertex.y + (yMax - yMin) / 2) / (yMax - yMin)) * (yMax - yMin);

      // Compute z value from function
      const z = fn(x, y);

      // Update the vertex position
      positionAttribute.setZ(i, z);
    }

    // Update normals
    planeGeometry.computeVertexNormals();

    return planeGeometry;
  }, [fn, xRange, yRange, resolution]);

  return (
    <mesh ref={meshRef} geometry={geometry} {...props}>
      <meshStandardMaterial
        color={color}
        side={THREE.DoubleSide}
        wireframe={wireframe}
      />
    </mesh>
  );
}

/**
 * Function2D component for plotting 2D functions on a specific plane
 */
export function Function2D({
  fn,
  plane = "xy",
  color = COLORS.CYAN,
  range = [-5, 5],
  resolution = 100,
  lineWidth = 3,
  ...props
}: Function2DProps) {
  // Create points for the curve
  const points = useMemo(() => {
    const [min, max] = range;
    const step = (max - min) / resolution;
    const pointArray: THREE.Vector3[] = [];

    for (let i = 0; i <= resolution; i++) {
      const x = min + i * step;
      const y = fn(x);

      if (plane === "xy") {
        pointArray.push(new THREE.Vector3(x, y, 0));
      } else if (plane === "xz") {
        pointArray.push(new THREE.Vector3(x, 0, y));
      } else if (plane === "yz") {
        pointArray.push(new THREE.Vector3(0, x, y));
      }
    }

    return pointArray;
  }, [fn, plane, range, resolution]);

  return (
    <Line points={points} color={color} lineWidth={lineWidth} {...props} />
  );
}

// --------------------------------
// Main Components
// --------------------------------

/**
 * Vector component for drawing vectors in 3D space
 */
export function Vector(props: VectorProps) {
  return <ArrowHelper {...props} />;
}

/**
 * Triangle component for displaying a right triangle
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
}: TriangleProps) {
  const { resolvedTheme } = useTheme();

  // Convert angle to radians and calculate the points
  const angleInRadians = (angle * Math.PI) / 180;

  // Identify which quadrant the angle is in
  const quadrant = (Math.floor(angle / 90) % 4) + 1;

  // Create a right triangle with sides of variable length based on the angle
  const hypotenuse = size; // Scale the hypotenuse by the size parameter
  const adjacent = Math.cos(angleInRadians) * hypotenuse;
  const opposite = Math.sin(angleInRadians) * hypotenuse;

  // Triangle points
  const originPoint = new THREE.Vector3(0, 0, 0);
  const adjacentPoint = new THREE.Vector3(adjacent, 0, 0);
  const oppositePoint = new THREE.Vector3(adjacent, opposite, 0);

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
          .add(new THREE.Vector3(fontSize * 3.5, 0, 0));

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
          .add(new THREE.Vector3(-fontSize * 3.5, 0, 0));
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
          .add(new THREE.Vector3(-fontSize * 3.5, 0, 0));
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
          .add(new THREE.Vector3(fontSize * 3.5, 0, 0));
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
      <Line
        points={[originPoint, adjacentPoint]}
        color={COLORS.CYAN}
        lineWidth={2}
      />
      <Line
        points={[adjacentPoint, oppositePoint]}
        color={COLORS.ORANGE}
        lineWidth={2}
      />
      <Line
        points={[oppositePoint, originPoint]}
        color={COLORS.ROSE}
        lineWidth={2}
      />

      {/* Angle arc */}
      <Line
        points={Array.from({ length: 31 }).map((_, i) => {
          const a = (i / 30) * angleInRadians;
          return new THREE.Vector3(
            Math.cos(a) * arcRadius,
            Math.sin(a) * arcRadius,
            0
          );
        })}
        color={COLORS.VIOLET}
        lineWidth={2}
      />

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
      <mesh position={originPoint} scale={vertexSize}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color={baseColor} />
      </mesh>

      <mesh position={adjacentPoint} scale={vertexSize}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color={baseColor} />
      </mesh>

      <mesh position={oppositePoint} scale={vertexSize}>
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color={baseColor} />
      </mesh>
    </group>
  );
}

/**
 * Trigonometry component for displaying trigonometric functions
 */
export function UnitCircle({
  angle = 45,
  showLabels = true,
  displayMode = "exact",
  precision = 2,
  useMonoFont = true,
  ...props
}: UnitCircleProps) {
  const t = useTranslations("Common");
  const { resolvedTheme } = useTheme();

  const angleInRadians = (angle * Math.PI) / 180;
  const sin = Math.sin(angleInRadians);
  const cos = Math.cos(angleInRadians);
  // Check if cos is close to zero to handle tan(90°), tan(270°), etc.
  const tan = Math.abs(cos) < 1e-10 ? Number.POSITIVE_INFINITY : sin / cos;

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
          points={Array.from({ length: 101 }).map((_, i) => {
            const a = (i / 100) * Math.PI * 2;
            return new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
          })}
          color={
            resolvedTheme === "dark" ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK
          }
          lineWidth={2}
        />

        {/* Angle arc */}
        <Line
          points={Array.from({ length: 31 }).map((_, i) => {
            const a = (i / 30) * angleInRadians;
            return new THREE.Vector3(Math.cos(a) * 0.3, Math.sin(a) * 0.3, 0);
          })}
          color={COLORS.VIOLET}
          lineWidth={2}
        />

        {/* Angle label */}
        {showLabels && (
          <Text
            position={[
              Math.cos(angleInRadians / 2) * 0.5,
              Math.sin(angleInRadians / 2) * 0.4,
              0,
            ]}
            color={COLORS.VIOLET}
            fontSize={0.12}
            font={fontPath}
          >
            {`${angle}°`}
          </Text>
        )}

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
        {showLabels && (
          <>
            <Text
              position={[cos / 2, -0.2, 0]}
              color={COLORS.CYAN}
              fontSize={0.12}
              font={fontPath}
              anchorX="center"
            >
              {cosLabel}
            </Text>
            <Text
              position={[cos + 0.3, sin / 2, 0]}
              color={COLORS.ORANGE}
              fontSize={0.12}
              font={fontPath}
              anchorX="left"
              anchorY="middle"
            >
              {sinLabel}
            </Text>
            <Text
              position={[1.1, 1.1, 0]}
              color={COLORS.ROSE}
              fontSize={0.12}
              font={fontPath}
            >
              {tanLabel}
            </Text>
          </>
        )}
      </group>
    </group>
  );
}

/**
 * CoordinateSystem component for creating a 3D coordinate system
 */
function CoordinateSystemComponent({
  showGrid: initialShowGrid = true,
  showAxes = true,
  showZAxis = true,
  showOrigin = true,
  showLabels = true,
  showGizmo = true,
  gridSize = 15,
  gridDivisions = 15,
  size = 15,
  backgroundColor = "transparent",
  cameraPosition = [12, 8, 12],
  font = "mono",
  children,
  className,
}: CoordinateSystemProps) {
  const { resolvedTheme } = useTheme();
  const [showGrid, setShowGrid] = useState(initialShowGrid);
  const [play, setPlay] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);

  // Color mapping based on color scheme
  const gridColors = useMemo(() => {
    switch (resolvedTheme) {
      case "dark":
        return {
          main: "#3f3f46",
          secondary: "#52525c",
        };
      default:
        return {
          main: "#d4d4d8",
          secondary: "#9f9fa9",
        };
    }
  }, [resolvedTheme]);

  // Origin point color based on theme
  const originColor = useMemo(() => {
    return resolvedTheme === "dark" ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK;
  }, [resolvedTheme]);

  return (
    <div
      className={cn(
        "relative aspect-square overflow-hidden rounded-md sm:aspect-video",
        className
      )}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true }}
        style={{ background: backgroundColor }}
        onCreated={() => setTimeout(() => setSceneReady(true), 100)}
      >
        <CameraControls cameraPosition={cameraPosition} autoRotate={play} />

        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} castShadow />

        {/* Coordinate System */}
        {showAxes && (
          <Axes
            size={size}
            showLabels={showLabels}
            showZAxis={showZAxis}
            font={font}
          />
        )}
        {showOrigin && <Origin color={originColor} />}
        {/* Grid */}
        {showGrid && (
          <>
            <Grid
              args={[gridSize * 2, gridSize * 2, gridDivisions, gridDivisions]}
              position={[0, 0, 0]}
              rotation={[0, 0, 0]}
              cellColor={gridColors.secondary}
              sectionColor={gridColors.main}
              fadeDistance={50}
              fadeStrength={1}
            />
            <Grid
              args={[gridSize * 2, gridSize * 2, gridDivisions, gridDivisions]}
              position={[0, 0, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              cellColor={gridColors.secondary}
              sectionColor={gridColors.main}
              fadeDistance={50}
              fadeStrength={1}
            />
            <Grid
              args={[gridSize * 2, gridSize * 2, gridDivisions, gridDivisions]}
              position={[0, 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
              cellColor={gridColors.secondary}
              sectionColor={gridColors.main}
              fadeDistance={50}
              fadeStrength={1}
            />
          </>
        )}

        {/* User Content */}
        {children}

        {/* Orientation Helper */}
        {showGizmo && (
          <GizmoHelper alignment="bottom-right" margin={[56, 56]}>
            <GizmoViewport
              axisColors={[COLORS.RED, COLORS.GREEN, COLORS.BLUE]}
              labelColor={ORIGIN_COLOR.LIGHT}
            />
          </GizmoHelper>
        )}
      </Canvas>

      {/* UI Controls */}
      <div
        className={cn(
          "absolute bottom-3 left-3 flex gap-2 transition-opacity duration-300 ease-in-out",
          sceneReady ? "opacity-100" : "opacity-0"
        )}
      >
        <Button
          variant="secondary"
          size="icon"
          onClick={() => setShowGrid(!showGrid)}
        >
          {showGrid ? (
            <Grid2x2Icon className="size-4" />
          ) : (
            <Grid2X2XIcon className="size-4" />
          )}
          <span className="sr-only">Toggle Grid</span>
        </Button>
        <Button
          variant={play ? "secondary" : "default"}
          size="icon"
          onClick={() => setPlay(!play)}
        >
          {play ? (
            <PauseIcon className="size-4" />
          ) : (
            <PlayIcon className="size-4" />
          )}
          <span className="sr-only">Toggle Play</span>
        </Button>
      </div>
    </div>
  );
}
export const CoordinateSystem = dynamic(
  () => Promise.resolve(CoordinateSystemComponent),
  {
    ssr: false,
    loading: () => (
      <div className="relative aspect-square overflow-hidden rounded-md sm:aspect-video" />
    ),
  }
);
