import { Line } from "@react-three/drei";
import {
  getPeriodicPropertyModeColor,
  PERIODIC_PROPERTY_MODES,
  type PeriodicPropertiesSceneColors,
  type PeriodicPropertyMode,
  type PeriodicPropertyModeId,
  type PeriodicPropertySample,
} from "@repo/design-system/components/contents/chemistry/periodic-properties/data";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { ArrowHelper } from "@repo/design-system/components/three/arrow-helper";
import type { ThreeFontSize } from "@repo/design-system/components/three/data/constants";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { Array as Arr, Option } from "effect";
import { createContext, type ReactNode, use } from "react";

const PERIOD_Z = -1.18;
const PERIOD_STEP = 0.78;
const GROUP_X = -2.8;
const GROUP_START_Z = -0.46;
const GROUP_STEP = 0.8;
const RAIL_Y = -0.04;
const PERIOD_RAIL_Z_OFFSET = 0.34;
const GROUP_RAIL_X_OFFSET = 0.34;
const PILLAR_RADIUS = 0.17;
const PILLAR_MIN_HEIGHT = 0.18;
const PILLAR_MAX_HEIGHT = 1.46;
const SPHERE_MIN_RADIUS = 0.18;
const SPHERE_MAX_RADIUS = 0.38;
const MARKER_LABEL_OUTLINE_WIDTH = 0.012;
const PILLAR_LABEL_OFFSET = 0.22;
const SCENE_SCALE = 1.12;
const SCENE_Y_OFFSET = 0.62;

type ScenePoint = [number, number, number];
type TrendAxis = "period" | "group";

/** The colors, the mode and the value range that the parts of a periodic-properties scene read. */
const PeriodicPropertiesSceneContext = createContext<{
  colors: PeriodicPropertiesSceneColors;
  mode: PeriodicPropertyMode;
  range: PeriodicPropertyRange;
} | null>(null);

/** Reads the colors, the mode and the value range of the surrounding periodic-properties scene. */
function usePeriodicPropertiesScene() {
  const scene = use(PeriodicPropertiesSceneContext);
  if (!scene) {
    // A missing provider is a programmer composition error at this React seam.
    throw new Error(
      "usePeriodicPropertiesScene must be used within PeriodicPropertiesScene"
    );
  }
  return scene;
}

/**
 * Renders the active periodic trend as two readable 3D sample tracks.
 */
export function PeriodicPropertiesScene({
  colors,
  modeId,
}: {
  colors: PeriodicPropertiesSceneColors;
  modeId: PeriodicPropertyModeId;
}) {
  const mode = PERIODIC_PROPERTY_MODES[modeId];
  const modeColor = getPeriodicPropertyModeColor(modeId);
  const range = getModeRange(mode);

  return (
    <PeriodicPropertiesSceneContext value={{ colors, mode, range }}>
      <group position={[0, SCENE_Y_OFFSET, 0]} scale={SCENE_SCALE}>
        <TrendTrack
          axis="period"
          color={modeColor}
          samples={mode.periodSamples}
        />

        <TrendTrack
          axis="group"
          color={modeColor}
          samples={mode.groupSamples}
        />
      </group>
    </PeriodicPropertiesSceneContext>
  );
}

/**
 * Draws one sample track and the arrow showing reading direction.
 */
function TrendTrack({
  axis,
  color,
  samples,
}: {
  axis: TrendAxis;
  color: string;
  samples: readonly PeriodicPropertySample[];
}) {
  const { colors } = usePeriodicPropertiesScene();
  const markerPoints = getTrackPoints(axis, samples.length);
  const railPoints = getRailPoints(axis, markerPoints);
  const [startPoint] = railPoints;
  const endPoint = Arr.last(railPoints);

  if (!startPoint || Option.isNone(endPoint)) {
    return null;
  }

  return (
    <group>
      <Line color={colors.rail} lineWidth={2} points={railPoints} />
      <ArrowHelper
        arrowSize={0.16}
        color={color}
        from={startPoint}
        lineWidth={3}
        to={endPoint.value}
      />

      {Arr.map(samples, (sample, sampleIndex) => (
        <TrendMarker
          color={color}
          key={`${axis}-${sample.symbol}`}
          position={markerPoints[sampleIndex]}
          sample={sample}
        />
      ))}
    </group>
  );
}

/**
 * Renders one element marker with the symbol attached to the visible face.
 */
function TrendMarker({
  color,
  position,
  sample,
}: {
  color: string;
  position: ScenePoint;
  sample: PeriodicPropertySample;
}) {
  const { mode, range } = usePeriodicPropertiesScene();
  if (mode.marker === "sphere") {
    const radius = scaleValue(
      sample.value,
      range,
      SPHERE_MIN_RADIUS,
      SPHERE_MAX_RADIUS
    );

    return (
      <group position={position}>
        <mesh castShadow position={[0, radius, 0]}>
          <sphereGeometry args={[radius, 36, 24]} />
          <meshStandardMaterial color={color} roughness={0.42} />
        </mesh>
        <MarkerLabel fontSize="compact" position={[0, radius, 0]}>
          <InlineMath math={`\\mathrm{${sample.symbol}}`} />
        </MarkerLabel>
      </group>
    );
  }

  const height = scaleValue(
    sample.value,
    range,
    PILLAR_MIN_HEIGHT,
    PILLAR_MAX_HEIGHT
  );

  return (
    <group position={position}>
      <mesh castShadow position={[0, height / 2, 0]} receiveShadow>
        <cylinderGeometry args={[PILLAR_RADIUS, PILLAR_RADIUS, height, 36]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.06}
          roughness={0.44}
        />
      </mesh>
      <MarkerLabel
        fontSize="annotation"
        position={[0, height + PILLAR_LABEL_OFFSET, 0]}
      >
        <InlineMath math={`\\mathrm{${sample.symbol}}`} />
      </MarkerLabel>
    </group>
  );
}

/**
 * Keeps marker symbols readable while orbit controls rotate the scene.
 */
function MarkerLabel({
  children,
  fontSize,
  position,
}: {
  children: ReactNode;
  fontSize: ThreeFontSize;
  position: ScenePoint;
}) {
  const { colors } = usePeriodicPropertiesScene();
  return (
    <ThreeLabel
      color={colors.markerText}
      fontSize={fontSize}
      maximumFontSize={18}
      minimumFontSize={12}
      outlineColor={colors.markerTextOutline}
      outlineWidth={MARKER_LABEL_OUTLINE_WIDTH}
      position={position}
    >
      {children}
    </ThreeLabel>
  );
}

type PeriodicPropertyRange = ReturnType<typeof getModeRange>;

/**
 * Calculates the visible value range for the selected property.
 */
function getModeRange(mode: PeriodicPropertyMode) {
  const values = Arr.map(
    [...mode.periodSamples, ...mode.groupSamples],
    ({ value }) => value
  );

  return {
    max: Math.max(...values),
    min: Math.min(...values),
  };
}

/**
 * Scales one data value into a stable 3D marker size.
 */
function scaleValue(
  value: number,
  range: PeriodicPropertyRange,
  outputMin: number,
  outputMax: number
) {
  if (range.max === range.min) {
    return outputMin;
  }

  const ratio = (value - range.min) / (range.max - range.min);

  return outputMin + ratio * (outputMax - outputMin);
}

/**
 * Places sample points for either the period track or the group track.
 */
function getTrackPoints(axis: TrendAxis, sampleCount: number) {
  return Array.from({ length: sampleCount }, (_, sampleIndex) => {
    if (axis === "period") {
      return [
        getCenteredOffset(sampleIndex, sampleCount, PERIOD_STEP),
        RAIL_Y,
        PERIOD_Z,
      ] satisfies ScenePoint;
    }

    return [
      GROUP_X,
      RAIL_Y,
      GROUP_START_Z + sampleIndex * GROUP_STEP,
    ] satisfies ScenePoint;
  });
}

/**
 * Offsets the guide rail away from markers so direction arrows do not cut through the data.
 */
function getRailPoints(axis: TrendAxis, markerPoints: readonly ScenePoint[]) {
  return Arr.map(markerPoints, ([x, , z]) => {
    if (axis === "period") {
      return [x, RAIL_Y, z + PERIOD_RAIL_Z_OFFSET] satisfies ScenePoint;
    }

    return [x + GROUP_RAIL_X_OFFSET, RAIL_Y, z] satisfies ScenePoint;
  });
}

/**
 * Centers a row of evenly spaced points around the scene origin.
 */
function getCenteredOffset(index: number, count: number, step: number) {
  return (index - (count - 1) / 2) * step;
}
