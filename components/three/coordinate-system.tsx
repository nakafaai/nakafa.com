"use client";

import { cn } from "@/lib/utils";
import { COLORS } from "@/lib/utils/color";
import { GizmoHelper, GizmoViewport, Grid } from "@react-three/drei";
import { Grid2X2XIcon, PauseIcon, PlayIcon } from "lucide-react";
import { Grid2x2Icon } from "lucide-react";
import { useTheme } from "next-themes";
import {
  type CSSProperties,
  type ReactNode,
  Suspense,
  useCallback,
  useMemo,
  useState,
} from "react";
import { ThreeCanvas } from "../three/canvas";
import { Button } from "../ui/button";
import { ORIGIN_COLOR } from "./_data";
import { Axes } from "./axes";
import { CameraControls } from "./camera-controls";
import { Origin } from "./origin";

type Props = {
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
  backgroundColor?: CSSProperties["backgroundColor"];
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
}: Props) {
  const { resolvedTheme } = useTheme();
  const [showGrid, setShowGrid] = useState(initialShowGrid);
  const [play, setPlay] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);

  // Color mapping based on color scheme - memoized
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

  // Origin point color based on theme - memoized
  const originColor = useMemo(() => {
    return resolvedTheme === "dark" ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK;
  }, [resolvedTheme]);

  // Memoize callbacks to prevent child re-renders
  const handleToggleGrid = useCallback(() => {
    setShowGrid((prev) => !prev);
  }, []);

  const handleTogglePlay = useCallback(() => {
    setPlay((prev) => !prev);
  }, []);

  const handleCanvasCreated = useCallback(() => {
    setTimeout(() => setSceneReady(true), 100);
  }, []);

  // Memoize gizmo colors
  const gizmoAxisColors: [string, string, string] = useMemo(
    () => [COLORS.RED, COLORS.GREEN, COLORS.BLUE],
    []
  );

  return (
    <div
      className={cn(
        "relative aspect-square overflow-hidden rounded-md sm:aspect-[1.43/1]", // IMAX aspect ratio
        className
      )}
    >
      <ThreeCanvas
        style={{ background: backgroundColor }}
        onCreated={handleCanvasCreated}
      >
        <Suspense fallback={null}>
          {/* Camera Controls */}
          <CameraControls cameraPosition={cameraPosition} autoRotate={play} />

          {/* Lighting - optimized with lower shadow resolution */}
          <ambientLight intensity={0.5} />
          <pointLight
            position={[10, 10, 10]}
            intensity={1}
            castShadow={false} // Disable shadows for performance
          />

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

          {/* Grid - using memoized components */}
          <Grid
            visible={showGrid}
            position={[0, 0, 0]}
            rotation={[0, 0, 0]}
            args={[gridSize * 2, gridSize * 2, gridDivisions, gridDivisions]}
            cellColor={gridColors.secondary}
            sectionColor={gridColors.main}
            fadeDistance={50}
            fadeStrength={1}
          />
          <Grid
            visible={showGrid}
            position={[0, 0, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            args={[gridSize * 2, gridSize * 2, gridDivisions, gridDivisions]}
            cellColor={gridColors.secondary}
            sectionColor={gridColors.main}
            fadeDistance={50}
            fadeStrength={1}
          />
          <Grid
            visible={showGrid}
            position={[0, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
            args={[gridSize * 2, gridSize * 2, gridDivisions, gridDivisions]}
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
              axisColors={gizmoAxisColors}
              labelColor={ORIGIN_COLOR.LIGHT}
            />
          </GizmoHelper>
        </Suspense>
      </ThreeCanvas>

      {/* UI Controls - memoized */}
      <div
        className={cn(
          "absolute bottom-3 left-3 flex gap-2 transition-opacity duration-300 ease-in-out",
          sceneReady ? "opacity-100" : "opacity-0"
        )}
      >
        <Button variant="secondary" size="icon" onClick={handleToggleGrid}>
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
          onClick={handleTogglePlay}
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
