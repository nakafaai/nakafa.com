"use client";

import {
  GridIcon,
  GridOffIcon,
  PauseIcon,
  PlayIcon,
} from "@hugeicons/core-free-icons";
import { GizmoHelper, GizmoViewport } from "@react-three/drei";
import { Axes } from "@repo/design-system/components/three/axes";
import { CameraControls } from "@repo/design-system/components/three/camera-controls";
import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import { ORIGIN_COLOR } from "@repo/design-system/components/three/data/constants";
import {
  type CoordinateFrame,
  createSymmetricFrame,
} from "@repo/design-system/components/three/frame";
import { CoordinateGrid } from "@repo/design-system/components/three/grid";
import { Origin } from "@repo/design-system/components/three/origin";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import { Button } from "@repo/design-system/components/ui/button";
import { HugeIcons } from "@repo/design-system/components/ui/huge-icons";
import { COLORS, getColor } from "@repo/design-system/lib/color";
import type { CameraProjection } from "@repo/design-system/lib/geometry/camera";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { cn } from "@repo/design-system/lib/utils";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  type CSSProperties,
  type ReactNode,
  Suspense,
  useCallback,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";

const GIZMO_MARGIN = 56;
const SCENE_READY_DELAY = 100;
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
  /** Show the coordinate axes */
  showAxes?: boolean;
  /** Show the gizmo helper for orientation */
  showGizmo?: boolean;
  /** Show the grid planes */
  showGrid?: boolean;
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
  showGrid: initialShowGrid = true,
  showAxes = true,
  showZAxis = true,
  showOrigin = true,
  showLabels = true,
  showGizmo = true,
  gridSize = 30,
  size = 30,
  backgroundColor = "transparent",
  cameraMaxDistance,
  cameraMinDistance,
  cameraPosition = [CAMERA_POSITION_X, CAMERA_POSITION_Y, CAMERA_POSITION_Z],
  cameraProjection,
  cameraTarget,
  frame,
  children,
  className,
}: Props) {
  const t = useTranslations("Common");
  const { resolvedTheme } = useTheme();
  const isDarkTheme = getThemeAppearance(resolvedTheme) === "dark";
  const [sceneState, setSceneState] = useState(() => ({
    isDragging: false,
    play: false,
    sceneReady: false,
    showGrid: initialShowGrid,
  }));
  const { isDragging, play, sceneReady, showGrid } = sceneState;

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

  // Handle button clicks with proper invalidation for on-demand rendering
  const handleGridToggle = useCallback(() => {
    setSceneState((current) => ({
      ...current,
      showGrid: !current.showGrid,
    }));
  }, []);

  const handlePlayToggle = useCallback(() => {
    setSceneState((current) => ({
      ...current,
      play: !current.play,
    }));
  }, []);

  // Handle pointer events for cursor changes
  const handlePointerDown = useCallback(() => {
    setSceneState((current) => ({
      ...current,
      isDragging: true,
    }));
  }, []);

  const handlePointerUp = useCallback(() => {
    setSceneState((current) => ({
      ...current,
      isDragging: false,
    }));
  }, []);

  // Activity hides preserved routes by disconnecting effects. ThreeCanvas owns
  // WebGL remounting, so this cleanup only resets local interaction state.
  useLayoutEffect(
    () => () => {
      setSceneState({
        isDragging: false,
        play: false,
        sceneReady: false,
        showGrid: initialShowGrid,
      });
    },
    [initialShowGrid]
  );

  return (
    <div
      className={cn(
        threeSceneFrameVariants(),
        "grid",
        isDragging ? "cursor-grabbing" : "cursor-grab",
        className
      )}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
    >
      <ThreeCanvas
        onCreated={() =>
          setTimeout(
            () =>
              setSceneState((current) => ({
                ...current,
                sceneReady: true,
              })),
            SCENE_READY_DELAY
          )
        }
        style={{ background: backgroundColor }}
      >
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
          <Axes
            frame={axisFrame}
            showLabels={showLabels}
            showZAxis={showZAxis}
            size={size}
            visible={showAxes}
          />

          {/* Origin */}
          <Origin color={originColor} visible={showOrigin} />

          {/* Grid */}
          {showGrid ? (
            <CoordinateGrid
              cellColor={gridColors.secondary}
              frame={gridFrame}
              sectionColor={gridColors.main}
            />
          ) : null}

          {/* User Content */}
          {children}

          {/* Orientation Helper */}
          {showGizmo ? (
            <GizmoHelper
              alignment="bottom-right"
              margin={[GIZMO_MARGIN, GIZMO_MARGIN]}
            >
              <GizmoViewport
                axisColors={[COLORS.RED, COLORS.GREEN, COLORS.BLUE]}
                labelColor={ORIGIN_COLOR.LIGHT}
              />
            </GizmoHelper>
          ) : null}
        </Suspense>
      </ThreeCanvas>

      {/* UI Controls */}
      <div
        className={cn(
          "absolute bottom-3 left-3 z-10 flex gap-2 transition-opacity duration-300 ease-out",
          sceneReady ? "opacity-100" : "opacity-0"
        )}
      >
        <Button
          aria-pressed={showGrid}
          onClick={handleGridToggle}
          size="icon"
          variant="secondary"
        >
          <HugeIcons icon={showGrid ? GridIcon : GridOffIcon} />
          <span className="sr-only">{t("grid")}</span>
        </Button>
        <Button
          aria-pressed={play}
          onClick={handlePlayToggle}
          size="icon"
          variant={play ? "secondary" : "default"}
        >
          <HugeIcons icon={play ? PauseIcon : PlayIcon} />
          <span className="sr-only">{t("automatic-rotation")}</span>
        </Button>
      </div>
    </div>
  );
}
