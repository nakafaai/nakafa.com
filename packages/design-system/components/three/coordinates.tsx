import { Axes } from "@repo/design-system/components/three/axes";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { ThreeCanvas } from "@repo/design-system/components/three/canvas";
import { useCoordinateControls } from "@repo/design-system/components/three/controls";
import type { CoordinateFrame } from "@repo/design-system/components/three/frame";
import { CoordinateGrid } from "@repo/design-system/components/three/grid";
import { Origin } from "@repo/design-system/components/three/origin";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { AxisTicks } from "@repo/design-system/components/three/ticks";
import { VisualCardBody } from "@repo/design-system/components/visual/card";
import { useRequired } from "@repo/design-system/hooks/required";
import { getColor } from "@repo/design-system/lib/color";
import type { CameraProjection } from "@repo/design-system/lib/geometry/camera";
import type { Point3 } from "@repo/design-system/lib/geometry/point";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { getThemeAppearance } from "@repo/design-system/lib/theme/registry";
import { useTheme } from "@repo/design-system/providers/theme";
import { cn } from "cn";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { createContext, useMemo } from "react";

const CAMERA_POSITION_X = 12;
const CAMERA_POSITION_Y = 8;
const CAMERA_POSITION_Z = 12;

interface Props {
  /** The name of the scene for assistive technology. A named scene is a region. */
  "aria-label"?: string | undefined;
  /** Background color of the canvas */
  backgroundColor?: CSSProperties["backgroundColor"];
  /**
   * How the first view is fitted. `"content"` fits everything the scene
   * draws, labels included, and fits again whenever that changes. `"focus"`
   * fits the `focus` box alone, on a wide card and on a phone alike, so a
   * scene whose marks and labels move keeps one steady view.
   */
  cameraFraming?: "content" | "focus" | undefined;
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
  /**
   * The region the first view frames, in world units. The world does not end
   * there: the grid, the axes and every unbounded object continue past it.
   */
  focus?: CoordinateFrame | undefined;
  /** Projected world coordinate of the mathematical origin. */
  origin?: Point3 | undefined;
  /**
   * Whether the card's play action turns the camera. A lab whose play action
   * sweeps one of its own parameters keeps the camera still.
   */
  playOrbit?: boolean;
  /**
   * Half-width, in world units, of the box around the world's center that the
   * camera can ever show, where the axes and the grid end out of sight.
   */
  reach?: number;
  /** World units that one mathematical unit takes on each axis; one by default. */
  scale?: Point3 | undefined;
  /** Show the coordinate axes */
  showAxes?: boolean;
  /** Show axis labels */
  showLabels?: boolean;
  /** Show the origin point */
  showOrigin?: boolean;
  /** Show the z-axis */
  showZAxis?: boolean;
  /** Number the axes at the grid's major lines (`AxisTicks`). */
  ticks?: boolean;
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
    Pick<ComponentProps<typeof Axes>, "reach" | "showLabels" | "showZAxis">
  > &
  Pick<ComponentProps<typeof Axes>, "origin"> &
  Required<Pick<Props, "playOrbit" | "showAxes">>;

const CoordinateSceneContext = createContext<CoordinateScene | null>(null);

/** Selects the configuration of the surrounding coordinate scene. */
function useCoordinateScene() {
  return useRequired(CoordinateSceneContext, "useCoordinateScene");
}

/** The scene's camera, with the controls that orbit and frame it. */
function CoordinateCamera() {
  const {
    cameraPosition,
    cameraTarget,
    framing,
    maxDistance,
    minDistance,
    playOrbit,
    projection,
  } = useCoordinateScene();

  return (
    <CameraControls
      cameraPosition={cameraPosition}
      cameraTarget={cameraTarget}
      framing={framing}
      maxDistance={maxDistance}
      minDistance={minDistance}
      orbitOnPlay={playOrbit}
      projection={projection}
    />
  );
}

/** The scene's axes, with its Z axis when the scene shows it. */
function CoordinateAxes() {
  const { origin, reach, showAxes, showLabels, showZAxis } =
    useCoordinateScene();

  return (
    <Axes
      origin={origin}
      reach={reach}
      showLabels={showAxes && showLabels}
      showZAxis={showZAxis}
      visible={showAxes}
    />
  );
}

/**
 * Renders an interactive coordinate scene in an unbounded world: the grid and
 * the axes run through the origin past every edge the camera can show, and
 * `focus` is only the region the first view frames. Its frame is the visual
 * card body, so it fills the card in full screen. The canvas fills the frame
 * by percentage, never by its own size, so it follows the frame both up and
 * down: back from full screen, or a phone turned to a narrower width.
 */
export function CoordinateSystem({
  showAxes = true,
  showZAxis = true,
  showOrigin = true,
  showLabels = true,
  reach = 100,
  backgroundColor = "transparent",
  cameraFraming,
  cameraMaxDistance,
  cameraMinDistance,
  cameraPosition = [CAMERA_POSITION_X, CAMERA_POSITION_Y, CAMERA_POSITION_Z],
  cameraProjection,
  cameraTarget,
  focus,
  origin,
  playOrbit = true,
  scale,
  ticks = false,
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

  const scene = useMemo(
    () => ({
      cameraPosition,
      cameraTarget,
      // Both modes fit: a focus fit only leaves the scene's own content out of the measure.
      framing: cameraFraming === undefined ? undefined : ("content" as const),
      maxDistance: cameraMaxDistance,
      minDistance: cameraMinDistance,
      origin,
      playOrbit,
      projection: cameraProjection,
      reach,
      showAxes,
      showLabels,
      showZAxis,
    }),
    [
      cameraFraming,
      cameraMaxDistance,
      cameraMinDistance,
      cameraPosition,
      cameraProjection,
      cameraTarget,
      origin,
      playOrbit,
      reach,
      showAxes,
      showLabels,
      showZAxis,
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
        {/* A graph casts no shadow: a shadow behind a curve, an asymptote or a point reads as a second mark. */}
        <ThreeCanvas shadows={false} style={{ background: backgroundColor }}>
          {/* Camera Controls */}
          <CoordinateCamera />

          {/* Flat, even light: a bright ambient fill and one key that only models a solid's faces. */}
          <ambientLight intensity={1.5} />
          <directionalLight intensity={1.2} position={[6, 10, 8]} />

          {/* Coordinate System */}
          {/* The camera fits the focus, or the true origin, never the decoration's length. */}
          <CameraBounds
            bounds={
              focus ??
              (showAxes
                ? {
                    x: { min: origin?.x ?? 0, max: origin?.x ?? 0 },
                    y: { min: origin?.y ?? 0, max: origin?.y ?? 0 },
                    z: { min: origin?.z ?? 0, max: origin?.z ?? 0 },
                  }
                : undefined)
            }
            exclude={!(focus || showAxes)}
          >
            <CoordinateAxes />

            {/* Origin */}
            <Origin
              color={PLOT_COLORS.slate}
              {...(origin ? { position: [origin.x, origin.y, origin.z] } : {})}
              size={0.06}
              visible={showOrigin}
            />
          </CameraBounds>

          {/* Grid */}
          {showGrid ? (
            <CameraBounds exclude>
              <CoordinateGrid
                cellColor={gridColors.secondary}
                origin={origin}
                reach={reach}
                scale={scale}
                sectionColor={gridColors.main}
              />
            </CameraBounds>
          ) : null}

          {ticks && showAxes ? (
            <CameraBounds exclude>
              <AxisTicks
                origin={origin}
                reach={reach}
                scale={scale ?? { x: 1, y: 1, z: 1 }}
                showZAxis={showZAxis}
              />
            </CameraBounds>
          ) : null}

          {/* User Content */}
          {cameraFraming === "focus" ? (
            <CameraBounds exclude>{children}</CameraBounds>
          ) : (
            children
          )}
        </ThreeCanvas>
      </VisualCardBody>
    </CoordinateSceneContext>
  );
}
