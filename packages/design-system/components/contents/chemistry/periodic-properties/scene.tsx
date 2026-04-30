import { Billboard, Line, Text } from "@react-three/drei";
import {
  getPeriodicPropertyModeColor,
  PERIODIC_PROPERTY_MODES,
  type PeriodicPropertiesSceneColors,
  type PeriodicPropertyMode,
  type PeriodicPropertyModeId,
  type PeriodicPropertySample,
} from "@repo/design-system/components/contents/chemistry/periodic-properties/data";
import { ArrowHelper } from "@repo/design-system/components/three/arrow-helper";
import {
  MONO_FONT_PATH,
  THREE_FONT_SIZE,
} from "@repo/design-system/components/three/data/constants";

const PERIOD_Z = -1.18;
const PERIOD_STEP = 0.62;
const GROUP_X = -2.08;
const GROUP_START_Z = -0.22;
const GROUP_STEP = 0.68;
const RAIL_Y = 0.03;
const PILLAR_RADIUS = 0.17;
const PILLAR_MIN_HEIGHT = 0.18;
const PILLAR_MAX_HEIGHT = 1.46;
const SPHERE_MIN_RADIUS = 0.19;
const SPHERE_MAX_RADIUS = 0.43;
const MARKER_LABEL_OUTLINE_WIDTH = 0.012;
const SPHERE_LABEL_FONT_RATIO = 0.92;
const SPHERE_LABEL_OFFSET_RATIO = 1.04;
const PILLAR_LABEL_OFFSET = 0.14;
const SCENE_SCALE = 1.12;
const SCENE_Y_OFFSET = 0.62;

type ScenePoint = [number, number, number];
type TrendAxis = "period" | "group";

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
    <group position={[0, SCENE_Y_OFFSET, 0]} scale={SCENE_SCALE}>
      <TrendTrack
        axis="period"
        color={modeColor}
        colors={colors}
        mode={mode}
        range={range}
        samples={mode.periodSamples}
      />

      <TrendTrack
        axis="group"
        color={modeColor}
        colors={colors}
        mode={mode}
        range={range}
        samples={mode.groupSamples}
      />
    </group>
  );
}

/**
 * Draws one sample track and the arrow showing reading direction.
 */
function TrendTrack({
  axis,
  color,
  colors,
  mode,
  range,
  samples,
}: {
  axis: TrendAxis;
  color: string;
  colors: PeriodicPropertiesSceneColors;
  mode: PeriodicPropertyMode;
  range: PeriodicPropertyRange;
  samples: readonly PeriodicPropertySample[];
}) {
  const points = getTrackPoints(axis, samples.length);
  const [startPoint] = points;
  const endPoint = points.at(-1);

  if (!(startPoint && endPoint)) {
    return null;
  }

  return (
    <group>
      <Line color={colors.rail} lineWidth={2} points={points} />
      <ArrowHelper
        arrowSize={0.16}
        color={color}
        from={startPoint}
        lineWidth={3}
        to={endPoint}
      />

      {samples.map((sample, sampleIndex) => (
        <TrendMarker
          color={color}
          colors={colors}
          key={`${axis}-${sample.symbol}`}
          mode={mode}
          position={points[sampleIndex]}
          range={range}
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
  colors,
  mode,
  position,
  range,
  sample,
}: {
  color: string;
  colors: PeriodicPropertiesSceneColors;
  mode: PeriodicPropertyMode;
  position: ScenePoint;
  range: PeriodicPropertyRange;
  sample: PeriodicPropertySample;
}) {
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
        <MarkerLabel
          colors={colors}
          fontSize={getMarkerFontSize(radius)}
          position={[0, radius, radius * SPHERE_LABEL_OFFSET_RATIO]}
        >
          {sample.symbol}
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
        colors={colors}
        fontSize={THREE_FONT_SIZE.reading}
        position={[0, height + PILLAR_LABEL_OFFSET, 0]}
      >
        {sample.symbol}
      </MarkerLabel>
    </group>
  );
}

/**
 * Keeps marker symbols readable while orbit controls rotate the scene.
 */
function MarkerLabel({
  children,
  colors,
  fontSize,
  position,
}: {
  children: string;
  colors: PeriodicPropertiesSceneColors;
  fontSize: number;
  position: ScenePoint;
}) {
  return (
    <Billboard position={position}>
      <Text
        anchorX="center"
        anchorY="middle"
        color={colors.markerText}
        font={MONO_FONT_PATH}
        fontSize={fontSize}
        outlineColor={colors.markerTextOutline}
        outlineWidth={MARKER_LABEL_OUTLINE_WIDTH}
        renderOrder={10}
      >
        {children}
        <meshBasicMaterial
          color={colors.markerText}
          depthTest={false}
          toneMapped={false}
        />
      </Text>
    </Billboard>
  );
}

type PeriodicPropertyRange = ReturnType<typeof getModeRange>;

/**
 * Calculates the visible value range for the selected property.
 */
function getModeRange(mode: PeriodicPropertyMode) {
  const values = [...mode.periodSamples, ...mode.groupSamples].map(
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
 * Centers a row of evenly spaced points around the scene origin.
 */
function getCenteredOffset(index: number, count: number, step: number) {
  return (index - (count - 1) / 2) * step;
}

/**
 * Keeps text inside radius spheres from overflowing.
 */
function getMarkerFontSize(radius: number) {
  return Math.min(radius * SPHERE_LABEL_FONT_RATIO, THREE_FONT_SIZE.reading);
}
