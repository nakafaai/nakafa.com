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

  // Color mapping based on color scheme
  const gridColors = useMemo(() => {
    switch (resolvedTheme) {
      case "dark":
        return {
          main: "#404040",
          secondary: "#262626",
        };
      default:
        return {
          main: "#d4d4d4",
          secondary: "#e5e5e5",
        };
    }
  }, [resolvedTheme]);

  // Origin point color based on theme
  const originColor = useMemo(() => {
    return resolvedTheme === "dark" ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK;
  }, [resolvedTheme]);

  // Handle button clicks with proper invalidation for on-demand rendering
  const handleGridToggle = useCallback(() => {
    setShowGrid(!showGrid);
  }, [showGrid]);

  const handlePlayToggle = useCallback(() => {
    setPlay(!play);
  }, [play]);

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
        <Button variant="secondary" size="icon" onClick={handleGridToggle}>
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
          onClick={handlePlayToggle}
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
