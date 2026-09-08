"use client";

import { Axes } from "@repo/design-system/components/three/axes";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { CameraControls } from "@repo/design-system/components/three/camera-controls";
import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import { useCoordinateControls } from "@repo/design-system/components/three/controls";
import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import {
  type CoordinateFrame,
  type CoordinatePoint,
  createSymmetricFrame,
} from "@repo/design-system/components/three/frame";
import { CoordinateGrid } from "@repo/design-system/components/three/grid";
import { Origin } from "@repo/design-system/components/three/origin";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import { getColor } from "@repo/design-system/lib/color";
import type { CameraProjection } from "@repo/design-system/lib/geometry/camera";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { cn } from "@repo/design-system/lib/utils";
import { useTheme } from "next-themes";
import { type CSSProperties, type ReactNode, Suspense, useMemo } from "react";

const CAMERA_POSITION_X = 12;
const CAMERA_POSITION_Y = 8;
const CAMERA_POSITION_Z = 12;

interface Props {
  /** Background color of the canvas */
  backgroundColor?: CSSProperties["backgroundColor"];
  /** Farthest orbit distance from the camera target. */
  cameraMaxDistance?: number;
  /** Nearest orbit distance from the camera target. */
  cameraMinDistance?: number;
  /** Custom camera position */
  cameraPosition?: [number, number, number];
  /** Perspective or exact orthographic camera projection. */
  cameraProjection?: CameraProjection;
  /** Custom point the camera looks at in Three.js world coordinates */
  cameraTarget?: [number, number, number];
  /** Children elements to render inside the coordinate system */
  children?: ReactNode;
  /** Additional class name */
  className?: string;
  /** Exact Cartesian frame. Overrides symmetric axis and grid sizes. */
  frame?: CoordinateFrame;
  /** Size of the grid */
  gridSize?: number;
  /** Projected world coordinate of the mathematical origin. */
  origin?: CoordinatePoint;
  /** Show the coordinate axes */
  showAxes?: boolean;
  /** Show axis labels */
  showLabels?: boolean;
  /** Show the origin point */
  showOrigin?: boolean;
  /** Show the z-axis */
  showZAxis?: boolean;
  /** Size of the coordinate system */
  size?: number;
}

/** Renders an interactive coordinate scene with grid and playback controls. */
export function CoordinateSystem({
  showAxes = true,
  showZAxis = true,
  showOrigin = true,
  showLabels = true,
  gridSize = 30,
  size = 30,
  backgroundColor = "transparent",
  cameraMaxDistance,
  cameraMinDistance,
  cameraPosition = [CAMERA_POSITION_X, CAMERA_POSITION_Y, CAMERA_POSITION_Z],
  cameraProjection,
  cameraTarget,
  frame,
  origin,
  children,
  className,
}: Props) {
  const { play, showGrid } = useCoordinateControls();
  const { resolvedTheme } = useTheme();
  const isDarkTheme = getThemeAppearance(resolvedTheme) === "dark";
  // Color mapping based on color scheme
  const gridColors = useMemo(() => {
    if (isDarkTheme) {
      return {
        main: getColor("NEUTRAL", 700),
        secondary: getColor("NEUTRAL", 800),
      };
    }

    return {
      main: getColor("NEUTRAL", 300),
      secondary: getColor("NEUTRAL", 200),
    };
  }, [isDarkTheme]);

  const originColor = isDarkTheme ? ORIGIN_COLOR.LIGHT : ORIGIN_COLOR.DARK;
  const axisFrame = useMemo(
    () => frame ?? createSymmetricFrame(size),
    [frame, size]
  );
  const gridFrame = useMemo(
    () => frame ?? createSymmetricFrame(gridSize),
    [frame, gridSize]
  );

  return (
    <div
      className={cn(threeSceneFrameVariants(), "grid cursor-grab", className)}
      data-slot="coordinate-system"
    >
      <ThreeCanvas style={{ background: backgroundColor }}>
        <Suspense>
          {/* Camera Controls */}
          <CameraControls
            autoRotate={play}
            cameraPosition={cameraPosition}
            cameraTarget={cameraTarget}
            maxDistance={cameraMaxDistance}
            minDistance={cameraMinDistance}
            projection={cameraProjection}
          />

          {/* Lighting */}
          <ambientLight intensity={0.5} />
          <pointLight intensity={1} position={[10, 10, 10]} />

          {/* Coordinate System */}
          <CameraBounds exclude={!frame}>
            <Axes
              frame={axisFrame}
              origin={origin}
              showLabels={showAxes && showLabels}
              showZAxis={showZAxis}
              size={size}
              visible={showAxes}
            />

            {/* Origin */}
            <Origin
              color={originColor}
              position={origin ? [origin.x, origin.y, origin.z] : undefined}
              visible={showOrigin}
            />
          </CameraBounds>

          {/* Grid */}
          {showGrid ? (
            <CameraBounds exclude>
              <CoordinateGrid
                cellColor={gridColors.secondary}
                frame={gridFrame}
                origin={origin}
                sectionColor={gridColors.main}
              />
            </CameraBounds>
          ) : null}

          {/* User Content */}
          {children}
        </Suspense>
      </ThreeCanvas>
    </div>
  );
}
