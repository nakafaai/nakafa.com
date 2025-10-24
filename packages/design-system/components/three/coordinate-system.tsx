"use client";

import { GizmoHelper, GizmoViewport, Grid } from "@react-three/drei";
import { Button } from "@repo/design-system/components/ui/button";
import { COLORS } from "@repo/design-system/lib/color";
import { cn } from "@repo/design-system/lib/utils";
import { Grid2X2XIcon, Grid2x2Icon, PauseIcon, PlayIcon } from "lucide-react";
import { useTheme } from "next-themes";
import {
  type CSSProperties,
  type ReactNode,
  Suspense,
  useCallback,
  useMemo,
  useState,
} from "react";
import { ORIGIN_COLOR } from "./_data";
import { Axes } from "./axes";
import { CameraControls } from "./camera-controls";
import { ThreeCanvas } from "./canvas";
import { Origin } from "./origin";

const GIZMO_MARGIN = 56;
const SCENE_READY_DELAY = 100;
const CAMERA_POSITION_X = 12;
const CAMERA_POSITION_Y = 8;
const CAMERA_POSITION_Z = 12;

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
  cameraPosition = [CAMERA_POSITION_X, CAMERA_POSITION_Y, CAMERA_POSITION_Z],
  font = "mono",
  children,
  className,
}: Props) {
  const { resolvedTheme } = useTheme();
  const [showGrid, setShowGrid] = useState(initialShowGrid);
  const [play, setPlay] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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
  const originColor = useMemo(
    () => (resolvedTheme === "dark" ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK),
    [resolvedTheme],
  );

  // Handle button clicks with proper invalidation for on-demand rendering
  const handleGridToggle = useCallback(() => {
    setShowGrid(!showGrid);
  }, [showGrid]);

  const handlePlayToggle = useCallback(() => {
    setPlay(!play);
  }, [play]);

  // Handle pointer events for cursor changes
  const handlePointerDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div
      className={cn(
        "relative grid aspect-square overflow-hidden rounded-md sm:aspect-[1.43/1]", // IMAX aspect ratio
        isDragging ? "cursor-grabbing" : "cursor-grab",
        className,
      )}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <ThreeCanvas
        onCreated={() =>
          setTimeout(() => setSceneReady(true), SCENE_READY_DELAY)
        }
        style={{ background: backgroundColor }}
      >
        <Suspense fallback={null}>
          {/* Camera Controls */}
          <CameraControls autoRotate={play} cameraPosition={cameraPosition} />

          {/* Lighting */}
          <ambientLight intensity={0.5} />
          <pointLight castShadow intensity={1} position={[10, 10, 10]} />

          {/* Coordinate System */}
          <Axes
            font={font}
            showLabels={showLabels}
            showZAxis={showZAxis}
            size={size}
            visible={showAxes}
          />

          {/* Origin */}
          <Origin color={originColor} visible={showOrigin} />

          {/* Grid */}
          <Grid
            args={[gridSize * 2, gridSize * 2, gridDivisions, gridDivisions]}
            cellColor={gridColors.secondary}
            fadeDistance={50}
            fadeStrength={1}
            position={[0, 0, 0]}
            rotation={[0, 0, 0]}
            sectionColor={gridColors.main}
            visible={showGrid}
          />
          <Grid
            args={[gridSize * 2, gridSize * 2, gridDivisions, gridDivisions]}
            cellColor={gridColors.secondary}
            fadeDistance={50}
            fadeStrength={1}
            position={[0, 0, 0]}
            rotation={[Math.PI / 2, 0, 0]}
            sectionColor={gridColors.main}
            visible={showGrid}
          />
          <Grid
            args={[gridSize * 2, gridSize * 2, gridDivisions, gridDivisions]}
            cellColor={gridColors.secondary}
            fadeDistance={50}
            fadeStrength={1}
            position={[0, 0, 0]}
            rotation={[0, 0, Math.PI / 2]}
            sectionColor={gridColors.main}
            visible={showGrid}
          />

          {/* User Content */}
          {children}

          {/* Orientation Helper */}
          <GizmoHelper
            alignment="bottom-right"
            margin={[GIZMO_MARGIN, GIZMO_MARGIN]}
            visible={showGizmo}
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
          "absolute bottom-3 left-3 flex gap-2 transition-opacity duration-300 ease-out",
          sceneReady ? "opacity-100" : "opacity-0",
        )}
      >
        <Button onClick={handleGridToggle} size="icon" variant="secondary">
          {showGrid ? (
            <Grid2x2Icon className="size-4" />
          ) : (
            <Grid2X2XIcon className="size-4" />
          )}
          <span className="sr-only">Toggle Grid</span>
        </Button>
        <Button
          onClick={handlePlayToggle}
          size="icon"
          variant={play ? "secondary" : "default"}
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
