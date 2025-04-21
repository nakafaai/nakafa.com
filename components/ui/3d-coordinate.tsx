"use client";

import { cn } from "@/lib/utils";
import { getCos, getRadians, getSin, getTan } from "@/lib/utils/math";
import {
  GizmoHelper,
  GizmoViewport,
  Grid,
  Instance,
  Instances,
  Line,
  OrbitControls,
  PerspectiveCamera,
  Text,
} from "@react-three/drei";
import { Grid2X2XIcon, PauseIcon, PlayIcon } from "lucide-react";
import { Grid2x2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  type ComponentProps,
  type ReactNode,
  Suspense,
  useMemo,
  useState,
} from "react";
import * as THREE from "three";
import { ThreeCanvas } from "../three/canvas";
import { Button } from "./button";

export const COLORS = {
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
export const ORIGIN_COLOR = {
  LIGHT: "#f4f4f5",
  DARK: "#18181b",
};

// Needs to load the fonts through URLs, not direct file system paths
// Font path for the 3D text
const FONT_PATH = "/fonts/Geist-Regular.ttf";
const MONO_FONT_PATH = "/fonts/GeistMono-Regular.ttf";

// Define a constant array of color keys at module level
const COLOR_KEYS = Object.keys(COLORS) as Array<keyof typeof COLORS>;

// Utils function
/**
 * Get a color from the COLORS object
 * @param color - The key of the color to get
 * @returns The color value
 */
export function getColor(color: keyof typeof COLORS) {
  return COLORS[color];
}

/**
 * Get a random color from the COLORS object
 * @param exclude - The keys of the colors to exclude
 * @returns The random color value
 */
export function randomColor(exclude?: (keyof typeof COLORS)[]) {
  // Filter the keys in a type-safe way
  const availableKeys = COLOR_KEYS.filter(
    (key) => !exclude || !exclude.some((excludeKey) => excludeKey === key)
  );

  // Handle the case where all colors are excluded
  if (availableKeys.length === 0) {
    return COLORS[COLOR_KEYS[0]]; // Return first color as fallback
  }

  return COLORS[
    availableKeys[Math.floor(Math.random() * availableKeys.length)]
  ];
}

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
 * Props for the LineEquation component
 */
export type LineEquationProps = {
  points: CoordinatePoint[];
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
  ...props
}: {
  size?: number;
  showLabels?: boolean;
  showZAxis?: boolean;
  labelSize?: number;
  labelOffset?: number;
  font?: CoordinateSystemProps["font"];
} & ComponentProps<"group">) {
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
    <group {...props}>
      <Line points={xPoints} color={COLORS.RED} lineWidth={2} />
      <Line points={yPoints} color={COLORS.GREEN} lineWidth={2} />
      <Line
        visible={showZAxis}
        points={zPoints}
        color={COLORS.BLUE}
        lineWidth={2}
      />

      <Text
        visible={showLabels}
        position={[size + labelOffset, 0, 0]}
        color={COLORS.RED}
        fontSize={labelSize}
        anchorX="left"
        font={fontToUse}
      >
        X
      </Text>
      <Text
        visible={showLabels}
        position={[-size - labelOffset, 0, 0]}
        color={COLORS.RED}
        fontSize={labelSize}
        anchorX="right"
        font={fontToUse}
      >
        -X
      </Text>
      <Text
        visible={showLabels}
        position={[0, size + labelOffset, 0]}
        color={COLORS.GREEN}
        fontSize={labelSize}
        anchorX="left"
        font={fontToUse}
      >
        Y
      </Text>
      <Text
        visible={showLabels}
        position={[0, -size - labelOffset, 0]}
        color={COLORS.GREEN}
        fontSize={labelSize}
        anchorX="left"
        font={fontToUse}
      >
        -Y
      </Text>

      <Text
        visible={showZAxis && showLabels}
        position={[0, 0, size + labelOffset]}
        color={COLORS.BLUE}
        fontSize={labelSize}
        anchorX="left"
        font={fontToUse}
      >
        Z
      </Text>
      <Text
        visible={showZAxis && showLabels}
        position={[0, 0, -size - labelOffset]}
        color={COLORS.BLUE}
        fontSize={labelSize}
        anchorX="left"
        font={fontToUse}
      >
        -Z
      </Text>
    </group>
  );
}

/**
 * Origin component that marks the (0,0,0) point
 */
export function Origin({
  size = 0.2,
  color = ORIGIN_COLOR.LIGHT,
  ...props
}: {
  size?: number;
  color?: string;
} & ComponentProps<"mesh">) {
  return (
    <mesh {...props}>
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

      <Text
        visible={!!label}
        position={[labelPos.x, labelPos.y, labelPos.z]}
        color={color instanceof THREE.Color ? color.getStyle() : color}
        fontSize={0.5}
        anchorX="left"
        font={fontToUse}
      >
        {label}
      </Text>
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

// After import * as THREE from "three";
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

/**
 * A 3D point in space
 */
export type CoordinatePoint = {
  x: number;
  y: number;
  z: number;
};

/**
 * This component renders a polyline based on an array of 3D points and optionally displays markers at each point.
 */
export function LineEquation({
  points,
  color = randomColor(["YELLOW", "GREEN", "BLUE"]),
  lineWidth = 2,
  showPoints = true,
  smooth = false,
  curvePoints = 50,
  labels = [],
  useMonoFont = true,
}: LineEquationProps) {
  const vectorPoints = useMemo(
    () => points.map((point) => new THREE.Vector3(point.x, point.y, point.z)),
    [points]
  );

  // Generate smooth curve points if smooth is true
  const linePoints = useMemo(() => {
    if (!smooth || vectorPoints.length < 2) {
      return vectorPoints;
    }

    // Create a smooth curve using CatmullRomCurve3
    const curve = new THREE.CatmullRomCurve3(vectorPoints);

    // Generate points along the curve
    return curve.getPoints(curvePoints);
  }, [vectorPoints, smooth, curvePoints]);

  const fontPath = useMonoFont ? MONO_FONT_PATH : FONT_PATH;

  const pointGeom = useMemo(() => new THREE.SphereGeometry(0.1, 16, 16), []);
  const pointMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color }),
    [color]
  );

  return (
    <group>
      {/* Draw a line connecting the provided points */}
      <Line points={linePoints} color={color} lineWidth={lineWidth} />
      {/* Optionally render a small sphere at each point */}

      <Instances
        visible={showPoints}
        geometry={pointGeom}
        material={pointMat}
        count={vectorPoints.length}
      >
        {vectorPoints.map((v, i) => (
          <Instance key={i} position={[v.x, v.y, v.z]} />
        ))}
      </Instances>

      {/* Render custom labels at specified indices */}
      {labels.map((label, idx) => {
        // Determine label index (default to midpoint)
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
        return (
          <Text
            key={`label-${idx}`}
            position={pos}
            color={label.color ?? color}
            fontSize={label.fontSize ?? 0.5}
            anchorX="center"
            anchorY="middle"
            font={fontPath}
          >
            {label.text}
          </Text>
        );
      })}
    </group>
  );
}

/**
 * Props for the Inequality component
 */
export type InequalityProps = {
  /** Function that determines if a point satisfies the inequality */
  condition: (x: number, y: number, z: number) => boolean;
  /** Function that determines the boundary of the inequality (where the inequality becomes equality) */
  boundaryFunction?: (x: number, y: number) => number;
  /** Indicates if this is a 2D inequality (like x + y <= 10) that should be extruded along z-axis */
  is2D?: boolean;
  /** For 2D inequalities, specifies the boundary line function where ax + by + c = 0
   * as [a, b, c]. For example, x + y = 10 would be [1, 1, -10] */
  boundaryLine2D?: [number, number, number];
  /** Range for x coordinate to visualize */
  xRange?: [number, number];
  /** Range for y coordinate to visualize */
  yRange?: [number, number];
  /** Range for z coordinate to visualize */
  zRange?: [number, number];
  /** Granularity of the visualization (higher means more detailed) */
  resolution?: number;
  /** Color for the inequality region */
  color?: string | THREE.Color;
  /** Color for the boundary line/plane */
  boundaryColor?: string | THREE.Color;
  /** Opacity of the region */
  opacity?: number;
  /** Width of the boundary line */
  boundaryLineWidth?: number;
  /** Show boundary line/plane */
  showBoundary?: boolean;
  /** Optional label for the inequality */
  label?: {
    /** Text to display */
    text: string;
    /** Position for the label */
    position: [number, number, number];
    /** Color for the label text */
    color?: string | THREE.Color;
    /** Font size of the label text */
    fontSize?: number;
  };
  /** Whether to use the mono font for the labels */
  useMonoFont?: boolean;
};

/**
 * This component renders a 3D region representing an inequality
 */
export function Inequality({
  condition,
  boundaryFunction,
  is2D = false,
  boundaryLine2D,
  xRange = [-5, 5],
  yRange = [-5, 5],
  zRange = [-5, 5],
  resolution = 200,
  color = COLORS.BLUE,
  boundaryColor,
  opacity = 0.1,
  boundaryLineWidth = 2,
  showBoundary = true,
  label,
  useMonoFont = true,
}: InequalityProps) {
  const fontPath = useMonoFont ? MONO_FONT_PATH : FONT_PATH;

  // Create a buffer geometry to hold the vertices of the inequality region
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This is a complex function, but it's necessary for the inequality visualization
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];

    // Define the step size based on resolution
    const xStep = (xRange[1] - xRange[0]) / resolution;
    const yStep = (yRange[1] - yRange[0]) / resolution;
    const zStep = (zRange[1] - zRange[0]) / resolution;

    // Helper function to add a quad (two triangles) to the geometry
    const addQuad = (
      p1: THREE.Vector3,
      p2: THREE.Vector3,
      p3: THREE.Vector3,
      p4: THREE.Vector3
    ) => {
      const index = vertices.length / 3;

      // Add vertices
      vertices.push(p1.x, p1.y, p1.z);
      vertices.push(p2.x, p2.y, p2.z);
      vertices.push(p3.x, p3.y, p3.z);
      vertices.push(p4.x, p4.y, p4.z);

      // Add indices for two triangles
      indices.push(index, index + 1, index + 2);
      indices.push(index, index + 2, index + 3);
    };

    // Helper function to create all faces of a complete cell
    const addCompleteCell = (
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      z1: number,
      z2: number
    ) => {
      // Create bottom face (at minimum z)
      addQuad(
        new THREE.Vector3(x1, y1, z1),
        new THREE.Vector3(x2, y1, z1),
        new THREE.Vector3(x2, y2, z1),
        new THREE.Vector3(x1, y2, z1)
      );

      // Create top face (at maximum z)
      addQuad(
        new THREE.Vector3(x1, y1, z2),
        new THREE.Vector3(x1, y2, z2),
        new THREE.Vector3(x2, y2, z2),
        new THREE.Vector3(x2, y1, z2)
      );

      // Create side faces
      // Front face (y = y1)
      addQuad(
        new THREE.Vector3(x1, y1, z1),
        new THREE.Vector3(x2, y1, z1),
        new THREE.Vector3(x2, y1, z2),
        new THREE.Vector3(x1, y1, z2)
      );

      // Back face (y = y2)
      addQuad(
        new THREE.Vector3(x1, y2, z1),
        new THREE.Vector3(x1, y2, z2),
        new THREE.Vector3(x2, y2, z2),
        new THREE.Vector3(x2, y2, z1)
      );

      // Left face (x = x1)
      addQuad(
        new THREE.Vector3(x1, y1, z1),
        new THREE.Vector3(x1, y1, z2),
        new THREE.Vector3(x1, y2, z2),
        new THREE.Vector3(x1, y2, z1)
      );

      // Right face (x = x2)
      addQuad(
        new THREE.Vector3(x2, y1, z1),
        new THREE.Vector3(x2, y2, z1),
        new THREE.Vector3(x2, y2, z2),
        new THREE.Vector3(x2, y1, z2)
      );
    };

    if (is2D && boundaryLine2D) {
      // Handle 2D inequality (like x + y <= 10) visualized as extruded along z-axis
      const [a, b, c] = boundaryLine2D;

      // Create a grid for the x-y plane, and extrude it along the z-axis
      for (let ix = 0; ix < resolution; ix++) {
        for (let iy = 0; iy < resolution; iy++) {
          const x1 = xRange[0] + ix * xStep;
          const x2 = xRange[0] + (ix + 1) * xStep;
          const y1 = yRange[0] + iy * yStep;
          const y2 = yRange[0] + (iy + 1) * yStep;

          // Check if this grid cell satisfies the inequality
          // We check all four corners to see if they satisfy the condition
          const corner1Satisfies = a * x1 + b * y1 + c <= 0;
          const corner2Satisfies = a * x2 + b * y1 + c <= 0;
          const corner3Satisfies = a * x2 + b * y2 + c <= 0;
          const corner4Satisfies = a * x1 + b * y2 + c <= 0;

          // Count the number of satisfied corners for a more nuanced approach
          const satisfiedCorners =
            (corner1Satisfies ? 1 : 0) +
            (corner2Satisfies ? 1 : 0) +
            (corner3Satisfies ? 1 : 0) +
            (corner4Satisfies ? 1 : 0);

          // Cell is on the boundary (some corners satisfy, some don't)
          if (satisfiedCorners > 0) {
            // For ultra-high resolutions, we need a completely different approach
            if (resolution >= 170) {
              // Only consider cells that are entirely inside the inequality region
              // This ensures absolute precision at the boundary
              if (satisfiedCorners === 4) {
                addCompleteCell(x1, y1, x2, y2, zRange[0], zRange[1]);
              }
              // For boundary cells, use a much stricter criterion based on distance
              else if (satisfiedCorners >= 3) {
                // Calculate the exact position on the boundary
                // For ax + by + c = 0, distance = |ax + by + c| / sqrt(a² + b²)
                const centerX = (x1 + x2) / 2;
                const centerY = (y1 + y2) / 2;
                const distanceToLine =
                  Math.abs(a * centerX + b * centerY + c) /
                  Math.sqrt(a * a + b * b);

                // Cell diagonal length (distance from corner to corner)
                const cellDiagonal = Math.sqrt(
                  (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)
                );

                // Apply an additional buffer near the boundary for perfect pixel alignment
                // This creates a small inset from the mathematical boundary to ensure precision
                const boundaryBuffer = 0.5; // Increased buffer for perfect edge

                // Only include cells that are very clearly inside the inequality region
                // This ensures no pixels extend beyond the boundary
                if (distanceToLine > cellDiagonal * (0.3 + boundaryBuffer)) {
                  addCompleteCell(x1, y1, x2, y2, zRange[0], zRange[1]);
                }
              }
            }
            // Super precise approach for high resolutions
            else if (resolution >= 120) {
              // For high resolution, only include cells that are almost entirely inside
              if (satisfiedCorners >= 3) {
                // Calculate how close the cell is to the boundary
                const centerX = (x1 + x2) / 2;
                const centerY = (y1 + y2) / 2;
                const distanceToLine =
                  Math.abs(a * centerX + b * centerY + c) /
                  Math.sqrt(a * a + b * b);

                // Cell diagonal length (distance from corner to corner)
                const cellDiagonal = Math.sqrt(
                  (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1)
                );

                // If the cell center is far enough from the boundary (compared to the cell size),
                // we can safely include it without any pixels extending beyond the boundary
                if (distanceToLine > cellDiagonal * 0.1) {
                  addCompleteCell(x1, y1, x2, y2, zRange[0], zRange[1]);
                }
              }
            }
            // High resolution but not ultra-high
            else if (resolution >= 80) {
              // For high resolutions, include cells with at least 2 corners inside
              if (satisfiedCorners >= 2) {
                addCompleteCell(x1, y1, x2, y2, zRange[0], zRange[1]);
              }
            }
            // For lower resolutions, we need more flexibility to avoid gaps
            else if (satisfiedCorners >= 2) {
              addCompleteCell(x1, y1, x2, y2, zRange[0], zRange[1]);
            }
          }
        }
      }
    } else if (boundaryFunction) {
      // Handle 3D inequality (like z > f(x,y))
      // Create visualization for z-dependent inequalities
      // This approach works well for inequalities like z > f(x,y)
      for (let ix = 0; ix < resolution; ix++) {
        for (let iy = 0; iy < resolution; iy++) {
          const x1 = xRange[0] + ix * xStep;
          const x2 = xRange[0] + (ix + 1) * xStep;
          const y1 = yRange[0] + iy * yStep;
          const y2 = yRange[0] + (iy + 1) * yStep;

          // For each (x,y) pair, find the z where the condition changes from true to false
          // This is a simplification - more complex inequalities might need different approaches
          let z = zRange[0];
          while (z <= zRange[1] && !condition(x1, y1, z)) {
            z += zStep;
          }

          if (z <= zRange[1]) {
            // We found a point where the condition is true
            // Create a quad at this height
            const p1 = new THREE.Vector3(x1, y1, z);
            const p2 = new THREE.Vector3(x2, y1, z);
            const p3 = new THREE.Vector3(x2, y2, z);
            const p4 = new THREE.Vector3(x1, y2, z);

            addQuad(p1, p2, p3, p4);
          }
        }
      }
    }

    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return geo;
  }, [
    condition,
    is2D,
    boundaryLine2D,
    boundaryFunction,
    xRange,
    yRange,
    zRange,
    resolution,
  ]);

  // Material for the inequality region
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: color instanceof THREE.Color ? color : new THREE.Color(color),
      transparent: true,
      opacity: opacity,
      side: THREE.DoubleSide,
    });
  }, [color, opacity]);

  // Generate boundary lines for rendering
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: This is a complex function, but it's necessary for the inequality visualization
  const boundaryLines = useMemo(() => {
    if ((!boundaryFunction && !boundaryLine2D) || !showBoundary) {
      return [];
    }

    const lines: THREE.Vector3[][] = [];
    const xStep = (xRange[1] - xRange[0]) / resolution;
    const yStep = (yRange[1] - yRange[0]) / resolution;

    if (is2D && boundaryLine2D) {
      // For 2D inequalities, create a vertical boundary plane
      const [a, b, c] = boundaryLine2D;

      // Handle different cases based on the coefficients
      if (Math.abs(b) > 1e-10) {
        // If b ≠ 0, we can express y as a function of x: y = -(a/b)x - c/b
        const linePoints1: THREE.Vector3[] = [];
        const linePoints2: THREE.Vector3[] = [];

        for (let ix = 0; ix <= resolution; ix++) {
          const x = xRange[0] + ix * xStep;
          const y = (-a * x - c) / b;

          // Check if y is within the y-range
          if (y >= yRange[0] && y <= yRange[1]) {
            // Create two points at min and max z for this (x,y)
            linePoints1.push(new THREE.Vector3(x, y, zRange[0]));
            linePoints2.push(new THREE.Vector3(x, y, zRange[1]));
          }
        }

        if (linePoints1.length > 1) {
          lines.push(linePoints1);
        }

        if (linePoints2.length > 1) {
          lines.push(linePoints2);
        }

        // Add vertical lines connecting min z to max z at regular intervals
        for (
          let i = 0;
          i < linePoints1.length;
          i += Math.max(1, Math.floor(linePoints1.length / 5))
        ) {
          if (i < linePoints1.length && i < linePoints2.length) {
            lines.push([linePoints1[i], linePoints2[i]]);
          }
        }
      } else if (Math.abs(a) > 1e-10) {
        // If a ≠ 0, we can express x as a function of y: x = -(b/a)y - c/a
        const linePoints1: THREE.Vector3[] = [];
        const linePoints2: THREE.Vector3[] = [];

        for (let iy = 0; iy <= resolution; iy++) {
          const y = yRange[0] + iy * yStep;
          const x = (-b * y - c) / a;

          // Check if x is within the x-range
          if (x >= xRange[0] && x <= xRange[1]) {
            // Create two points at min and max z for this (x,y)
            linePoints1.push(new THREE.Vector3(x, y, zRange[0]));
            linePoints2.push(new THREE.Vector3(x, y, zRange[1]));
          }
        }

        if (linePoints1.length > 1) {
          lines.push(linePoints1);
        }

        if (linePoints2.length > 1) {
          lines.push(linePoints2);
        }

        // Add vertical lines connecting min z to max z at regular intervals
        for (
          let i = 0;
          i < linePoints1.length;
          i += Math.max(1, Math.floor(linePoints1.length / 5))
        ) {
          if (i < linePoints1.length && i < linePoints2.length) {
            lines.push([linePoints1[i], linePoints2[i]]);
          }
        }
      }
    } else if (boundaryFunction) {
      // For 3D inequalities with z = f(x,y)
      // Create lines along the x-axis at different y values
      for (let iy = 0; iy <= resolution; iy++) {
        const y = yRange[0] + iy * yStep;
        const linePoints: THREE.Vector3[] = [];

        for (let ix = 0; ix <= resolution; ix++) {
          const x = xRange[0] + ix * xStep;
          const z = boundaryFunction(x, y);

          // Check if z is within range
          if (z >= zRange[0] && z <= zRange[1]) {
            linePoints.push(new THREE.Vector3(x, y, z));
          }
        }

        if (linePoints.length > 1) {
          lines.push(linePoints);
        }
      }

      // Create lines along the y-axis at different x values
      for (let ix = 0; ix <= resolution; ix++) {
        const x = xRange[0] + ix * xStep;
        const linePoints: THREE.Vector3[] = [];

        for (let iy = 0; iy <= resolution; iy++) {
          const y = yRange[0] + iy * yStep;
          const z = boundaryFunction(x, y);

          // Check if z is within range
          if (z >= zRange[0] && z <= zRange[1]) {
            linePoints.push(new THREE.Vector3(x, y, z));
          }
        }

        if (linePoints.length > 1) {
          lines.push(linePoints);
        }
      }
    }

    return lines;
  }, [
    boundaryFunction,
    boundaryLine2D,
    is2D,
    showBoundary,
    xRange,
    yRange,
    zRange,
    resolution,
  ]);

  // Default boundary color is the same as the region color but more opaque
  const finalBoundaryColor = boundaryColor || color;

  // Combine all boundary lines into a single BufferGeometry for fewer draw calls
  const boundarySegmentsGeometry = useMemo(() => {
    if (!showBoundary || boundaryLines.length === 0) {
      return undefined;
    }
    const vertices: number[] = [];
    for (const line of boundaryLines) {
      for (let i = 0; i < line.length - 1; i++) {
        const p1 = line[i];
        const p2 = line[i + 1];
        // push each segment as two points
        vertices.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
      }
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3)
    );
    return geom;
  }, [boundaryLines, showBoundary]);

  return (
    <group>
      {/* Render the shaded region */}
      <mesh geometry={geometry} material={material} />

      {/* Render the boundary as one lineSegments for better performance */}
      <lineSegments visible={showBoundary} geometry={boundarySegmentsGeometry}>
        <lineBasicMaterial
          color={finalBoundaryColor}
          linewidth={boundaryLineWidth}
        />
      </lineSegments>

      {/* Render label if provided */}
      <Text
        visible={!!label}
        position={label?.position ?? [0, 0, 0]}
        color={label?.color ?? color}
        fontSize={label?.fontSize ?? 0.5}
        anchorX="center"
        anchorY="middle"
        font={fontPath}
      >
        {label?.text}
      </Text>
    </group>
  );
}

/**
 * CoordinateSystem component for creating a 3D coordinate system
 */
export function CoordinateSystem({
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
        "relative aspect-square overflow-hidden rounded-md sm:aspect-[1.43/1]", // IMAX aspect ratio
        className
      )}
    >
      <ThreeCanvas
        style={{ background: backgroundColor }}
        onCreated={() => setTimeout(() => setSceneReady(true), 100)}
      >
        <Suspense fallback={null}>
          {/* Camera Controls */}
          <CameraControls cameraPosition={cameraPosition} autoRotate={play} />

          {/* Lighting */}
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} castShadow />

          {/* Coordinate System */}
          <Axes
            visible={showAxes}
            size={size}
            showLabels={showLabels}
            showZAxis={showZAxis}
            font={font}
          />

          {/* Origin */}
          <Origin visible={showOrigin} color={originColor} />

          {/* Grid */}
          <Grid
            visible={showGrid}
            args={[gridSize * 2, gridSize * 2, gridDivisions, gridDivisions]}
            position={[0, 0, 0]}
            rotation={[0, 0, 0]}
            cellColor={gridColors.secondary}
            sectionColor={gridColors.main}
            fadeDistance={50}
            fadeStrength={1}
          />
          <Grid
            visible={showGrid}
            args={[gridSize * 2, gridSize * 2, gridDivisions, gridDivisions]}
            position={[0, 0, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            cellColor={gridColors.secondary}
            sectionColor={gridColors.main}
            fadeDistance={50}
            fadeStrength={1}
          />
          <Grid
            visible={showGrid}
            args={[gridSize * 2, gridSize * 2, gridDivisions, gridDivisions]}
            position={[0, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
            cellColor={gridColors.secondary}
            sectionColor={gridColors.main}
            fadeDistance={50}
            fadeStrength={1}
          />

          {/* User Content */}
          {children}

          {/* Orientation Helper */}
          <GizmoHelper
            visible={showGizmo}
            alignment="bottom-right"
            margin={[56, 56]}
          >
            <GizmoViewport
              axisColors={[COLORS.RED, COLORS.GREEN, COLORS.BLUE]}
              labelColor={ORIGIN_COLOR.LIGHT}
            />
          </GizmoHelper>
        </Suspense>
      </ThreeCanvas>

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
