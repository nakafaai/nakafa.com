import { Axes } from "@repo/design-system/components/three/axes";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { CameraControls } from "@repo/design-system/components/three/camera-controls";
import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import { useCoordinateControls } from "@repo/design-system/components/three/controls";
import {
  type CoordinateFrame,
  createSymmetricFrame,
} from "@repo/design-system/components/three/frame";
import { CoordinateGrid } from "@repo/design-system/components/three/grid";
import { Origin } from "@repo/design-system/components/three/origin";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene-frame";
import { VisualCardBody } from "@repo/design-system/components/visual/card";
import { COLORS, getColor } from "@repo/design-system/lib/color";
import type { CameraProjection } from "@repo/design-system/lib/geometry/camera";
import type { Point3 } from "@repo/design-system/lib/geometry/point";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { useTheme } from "@repo/design-system/providers/theme";
import { cn } from "cn";
import {
  type ComponentProps,
  type CSSProperties,
  createContext,
  type ReactNode,
  Suspense,
  use,
  useMemo,
} from "react";

const CAMERA_POSITION_X = 12;
const CAMERA_POSITION_Y = 8;
const CAMERA_POSITION_Z = 12;

interface Props {
  /** The name of the scene for assistive technology. A named scene is a region. */
  "aria-label"?: string | undefined;
  /** Background color of the canvas */
  backgroundColor?: CSSProperties["backgroundColor"];
  /** Explicit complete-content fit for finite illustrations. */
  cameraFraming?: "content" | undefined;
  /** Farthest orbit distance from the camera target. */
  cameraMaxDistance?: number;
  /** Nearest orbit distance from the camera target. */
  cameraMinDistance?: number;
  /** Custom camera position */
  cameraPosition?: [number, number, number] | undefined;
  /** Perspective or exact orthographic camera projection. */
  cameraProjection?: CameraProjection | undefined;
  /** Custom point the camera looks at in Three.js world coordinates */
  cameraTarget?: [number, number, number] | undefined;
  /** Children elements to render inside the coordinate system */
  children?: ReactNode;
  /** Additional class name */
  className?: string;
  /** Exact Cartesian frame. Overrides symmetric axis and grid sizes. */
  frame?: CoordinateFrame;
  /** Size of the grid */
  gridSize?: number;
  /** Projected world coordinate of the mathematical origin. */
  origin?: Point3;
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

/**
 * The configuration of one coordinate scene, which its camera and axes read.
 * Each part takes the props of the component that draws it, so the scene keeps
 * the types those components declare.
 */
type CoordinateScene = Pick<
  ComponentProps<typeof CameraControls>,
  "cameraTarget" | "framing" | "maxDistance" | "minDistance" | "projection"
> &
  Required<Pick<ComponentProps<typeof CameraControls>, "cameraPosition">> &
  Required<
    Pick<
      ComponentProps<typeof Axes>,
      "frame" | "showLabels" | "showZAxis" | "size"
    >
  > &
  Pick<ComponentProps<typeof Axes>, "origin"> &
  Required<Pick<Props, "showAxes">>;

const CoordinateSceneContext = createContext<CoordinateScene | null>(null);

/** Selects the configuration of the surrounding coordinate scene. */
function useCoordinateScene() {
  const scene = use(CoordinateSceneContext);
  if (scene === null) {
    // A missing scene is a programmer composition error at this React seam.
    throw new Error("Coordinate scene parts require CoordinateSystem.");
  }
  return scene;
}

/** The scene's camera, with the controls that orbit and frame it. */
function CoordinateCamera() {
  const {
    cameraPosition,
    cameraTarget,
    framing,
    maxDistance,
    minDistance,
    projection,
  } = useCoordinateScene();

  return (
    <CameraControls
      cameraPosition={cameraPosition}
      cameraTarget={cameraTarget}
      framing={framing}
      maxDistance={maxDistance}
      minDistance={minDistance}
      projection={projection}
    />
  );
}

/** The scene's axes, with its Z axis when the scene shows it. */
function CoordinateAxes() {
  const { frame, origin, showAxes, showLabels, showZAxis, size } =
    useCoordinateScene();

  return (
    <Axes
      frame={frame}
      origin={origin}
      showLabels={showAxes && showLabels}
      showZAxis={showZAxis}
      size={size}
      visible={showAxes}
    />
  );
}

/**
 * Renders an interactive coordinate scene with grid and playback controls. Its
 * frame is the visual card body, so it fills the card in full screen. The
 * canvas fills the frame by percentage, never by its own size, so it follows
 * the frame both up and down: back from full screen, or a phone turned to a
 * narrower width.
 */
export function CoordinateSystem({
  showAxes = true,
  showZAxis = true,
  showOrigin = true,
  showLabels = true,
  gridSize,
  size = 100,
  backgroundColor = "transparent",
  cameraFraming,
  cameraMaxDistance,
  cameraMinDistance,
  cameraPosition = [CAMERA_POSITION_X, CAMERA_POSITION_Y, CAMERA_POSITION_Z],
  cameraProjection,
  cameraTarget,
  frame,
  origin,
  children,
  className,
  "aria-label": ariaLabel,
}: Props) {
  const showGrid = useCoordinateControls((controls) => controls.showGrid);
  const resolvedTheme = useTheme((state) => state.resolvedTheme);
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

  const axisFrame = useMemo(
    () => frame ?? createSymmetricFrame(size),
    [frame, size]
  );
  const gridFrame = useMemo(
    () => frame ?? createSymmetricFrame(gridSize ?? 100),
    [frame, gridSize]
  );
  const scene = useMemo(
    () => ({
      cameraPosition,
      cameraTarget,
      framing: cameraFraming,
      frame: axisFrame,
      maxDistance: cameraMaxDistance,
      minDistance: cameraMinDistance,
      origin,
      projection: cameraProjection,
      showAxes,
      showLabels,
      showZAxis,
      size,
    }),
    [
      axisFrame,
      cameraFraming,
      cameraMaxDistance,
      cameraMinDistance,
      cameraPosition,
      cameraProjection,
      cameraTarget,
      origin,
      showAxes,
      showLabels,
      showZAxis,
      size,
    ]
  );

  return (
    <CoordinateSceneContext value={scene}>
      <VisualCardBody
        aria-label={ariaLabel}
        className={cn(threeSceneFrameVariants(), "cursor-grab", className)}
        data-scene="coordinate-system"
        render={ariaLabel === undefined ? undefined : <section />}
      >
        <ThreeCanvas style={{ background: backgroundColor }}>
          <Suspense>
            {/* Camera Controls */}
            <CoordinateCamera />

            {/* Lighting */}
            <ambientLight intensity={0.5} />
            <pointLight intensity={1} position={[10, 10, 10]} />

            {/* Coordinate System */}
            {/* Fit the true origin without measuring decorative axis lengths. */}
            <CameraBounds
              bounds={
                !frame && showAxes
                  ? {
                      x: { min: origin?.x ?? 0, max: origin?.x ?? 0 },
                      y: { min: origin?.y ?? 0, max: origin?.y ?? 0 },
                      z: { min: origin?.z ?? 0, max: origin?.z ?? 0 },
                    }
                  : undefined
              }
              exclude={!(frame || showAxes)}
            >
              <CoordinateAxes />

              {/* Origin */}
              <Origin
                color={COLORS.SLATE}
                {...(origin
                  ? { position: [origin.x, origin.y, origin.z] }
                  : {})}
                size={0.06}
                visible={showOrigin}
              />
            </CameraBounds>

            {/* Grid */}
            {showGrid ? (
              <CameraBounds exclude>
                <CoordinateGrid
                  cellColor={gridColors.secondary}
                  frame={gridFrame}
                  infinite={!frame && gridSize === undefined}
                  origin={origin}
                  sectionColor={gridColors.main}
                />
              </CameraBounds>
            ) : null}

            {/* User Content */}
            {children}
          </Suspense>
        </ThreeCanvas>
      </VisualCardBody>
    </CoordinateSceneContext>
  );
}
