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
import { useTheme } from "next-themes";
import dynamic from "next/dynamic";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Button } from "./button";

const RED = "#e7000b";
const GREEN = "#00a63e";
const BLUE = "#155dfc";
const YELLOW = "#d08700";
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
  labelSize = 0.5,
  labelOffset = 0.5,
  font = "mono",
}: {
  size?: number;
  showLabels?: boolean;
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
      <Line points={xPoints} color={RED} lineWidth={2} />
      <Line points={yPoints} color={GREEN} lineWidth={2} />
      <Line points={zPoints} color={BLUE} lineWidth={2} />

      {showLabels && (
        <>
          <Text
            position={[size + labelOffset, 0, 0]}
            color={RED}
            fontSize={labelSize}
            anchorX="left"
            font={fontToUse}
          >
            X
          </Text>
          <Text
            position={[-size - labelOffset, 0, 0]}
            color={RED}
            fontSize={labelSize}
            anchorX="right"
            font={fontToUse}
          >
            -X
          </Text>
          <Text
            position={[0, size + labelOffset, 0]}
            color={GREEN}
            fontSize={labelSize}
            anchorX="left"
            font={fontToUse}
          >
            Y
          </Text>
          <Text
            position={[0, -size - labelOffset, 0]}
            color={GREEN}
            fontSize={labelSize}
            anchorX="left"
            font={fontToUse}
          >
            -Y
          </Text>
          <Text
            position={[0, 0, size + labelOffset]}
            color={BLUE}
            fontSize={labelSize}
            anchorX="left"
            font={fontToUse}
          >
            Z
          </Text>
          <Text
            position={[0, 0, -size - labelOffset]}
            color={BLUE}
            fontSize={labelSize}
            anchorX="left"
            font={fontToUse}
          >
            -Z
          </Text>
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
  color = "white",
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
  color = YELLOW,
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

  const arrowRef = useRef<THREE.ArrowHelper>(null);

  useEffect(() => {
    if (arrowRef.current) {
      arrowRef.current.position.copy(vectors.fromVec);
      arrowRef.current.setDirection(vectors.direction);
      arrowRef.current.setLength(vectors.length, arrowSize, arrowSize * 0.7);
    }
  }, [vectors, arrowSize]);

  const fontToUse = font === "mono" ? MONO_FONT_PATH : FONT_PATH;

  return (
    <group>
      <primitive
        ref={arrowRef}
        object={
          new THREE.ArrowHelper(
            vectors.direction,
            vectors.fromVec,
            vectors.length,
            color instanceof THREE.Color ? color : new THREE.Color(color),
            arrowSize,
            arrowSize * 0.7
          )
        }
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
  color = "hotpink",
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
  color = "cyan",
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
 * CoordinateSystem component for creating a 3D coordinate system
 */
function CoordinateSystemComponent({
  showGrid: initialShowGrid = true,
  showAxes = true,
  showLabels = true,
  showGizmo = true,
  gridSize = 30,
  gridDivisions = 30,
  size = 30,
  backgroundColor = "transparent",
  cameraPosition = [12, 8, 12],
  font = "mono",
  children,
  className,
}: CoordinateSystemProps) {
  const { resolvedTheme } = useTheme();
  const [showGrid, setShowGrid] = useState(initialShowGrid);
  const [play, setPlay] = useState(false);

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
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
        }}
        style={{ background: backgroundColor }}
      >
        <CameraControls cameraPosition={cameraPosition} autoRotate={play} />

        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} castShadow />

        {/* Coordinate System */}
        {showAxes && <Axes size={size} showLabels={showLabels} font={font} />}
        <Origin color={originColor} />

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
            <GizmoViewport axisColors={[RED, GREEN, BLUE]} labelColor="white" />
          </GizmoHelper>
        )}
      </Canvas>

      {/* UI Controls */}
      <div className="absolute bottom-3 left-3 flex gap-2">
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
