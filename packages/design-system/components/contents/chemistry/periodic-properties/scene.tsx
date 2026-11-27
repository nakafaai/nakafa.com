import { RoundedBox } from "@react-three/drei";
import type {
  PeriodicPropertiesSceneColors,
  PeriodicPropertyMode,
  PeriodicPropertyModeId,
  PeriodicPropertySample,
} from "@repo/design-system/components/contents/chemistry/periodic-properties/data";
import {
  getPeriodicPropertyModeColor,
  PERIODIC_PROPERTY_MODES,
} from "@repo/design-system/components/contents/chemistry/periodic-properties/data";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import type { ThreeFontSize } from "@repo/design-system/components/three/data/constants";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { MetalMaterial } from "@repo/design-system/components/three/physical";
import { useRequired } from "@repo/design-system/hooks/required";
import { INSTRUMENT_COLORS } from "@repo/design-system/lib/material/instrument";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { createContext, useEffect, useMemo } from "react";
import { ExtrudeGeometry, Shape } from "three";

const PERIOD_Z = -1.18;
const PERIOD_STEP = 0.78;
const GROUP_X = -2.8;
const GROUP_START_Z = -0.46;
const GROUP_STEP = 0.8;
const RAIL_Y = -0.04;

/** A display rail: how thick it is, how far it reaches past its end markers, and across. */
const RAIL = { margin: 0.56, thick: 0.09, width: 1.12 } as const;

/** How far a rail's inlaid arrow lies from its markers' line, toward the reader or the middle. */
const ARROW_OFFSET = 0.4;

/** The inlaid arrow: how wide its shaft and its head are, how long its head is, and how thick the inlay stands. */
const ARROW = {
  head: 0.2,
  headWidth: 0.15,
  shaft: 0.045,
  thick: 0.008,
} as const;
const PILLAR_RADIUS = 0.17;
const PILLAR_MIN_HEIGHT = 0.18;
const PILLAR_MAX_HEIGHT = 1.46;
const SPHERE_MIN_RADIUS = 0.18;
const SPHERE_MAX_RADIUS = 0.38;
const MARKER_LABEL_OUTLINE_WIDTH = 0.012;
const PILLAR_LABEL_OFFSET = 0.22;
const SCENE_SCALE = 1.12;
const SCENE_Y_OFFSET = 0.62;

/** The height of the table the display rails stand on. */
export const PERIODIC_PROPERTIES_FLOOR =
  SCENE_Y_OFFSET + (RAIL_Y - RAIL.thick) * SCENE_SCALE;

type ScenePoint = [number, number, number];
type TrendAxis = "period" | "group";

/** The colors, the mode and the value range that the parts of a periodic-properties scene read. */
const PeriodicPropertiesSceneContext = createContext<{
  color: string;
  colors: PeriodicPropertiesSceneColors;
  mode: PeriodicPropertyMode;
  range: PeriodicPropertyRange;
} | null>(null);

/** Reads the colors, the mode and the value range of the surrounding periodic-properties scene. */
function usePeriodicPropertiesScene() {
  return useRequired(
    PeriodicPropertiesSceneContext,
    "usePeriodicPropertiesScene"
  );
}

/**
 * The active periodic trend as a desk model: two anodised display rails on
 * a walnut table, one across for a period and one toward the reader for a
 * group, each carrying its elements as polished spheres or turned pillars
 * sized by the property, with a brass arrow inlaid along it in the direction
 * the trend is read.
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
    <PeriodicPropertiesSceneContext
      value={{ color: modeColor, colors, mode, range }}
    >
      <group position={[0, SCENE_Y_OFFSET, 0]} scale={SCENE_SCALE}>
        <TrendTrack axis="period" samples={mode.periodSamples} />

        <TrendTrack axis="group" samples={mode.groupSamples} />
      </group>
    </PeriodicPropertiesSceneContext>
  );
}

/**
 * One display rail with its markers and the brass arrow inlaid along it,
 * pointing the way the trend is read.
 */
function TrendTrack({
  axis,
  samples,
}: {
  axis: TrendAxis;
  samples: readonly PeriodicPropertySample[];
}) {
  const markerPoints = getTrackPoints(axis, samples.length);
  const span =
    (samples.length - 1) * (axis === "period" ? PERIOD_STEP : GROUP_STEP);
  const length = span + 2 * RAIL.margin;
  const middle: ScenePoint =
    axis === "period"
      ? [0, RAIL_Y - RAIL.thick / 2, PERIOD_Z]
      : [GROUP_X, RAIL_Y - RAIL.thick / 2, GROUP_START_Z + span / 2];
  const arrow = useMemo(() => arrowGeometry(span + RAIL.margin), [span]);
  useEffect(() => () => arrow.dispose(), [arrow]);

  return (
    <group>
      <RoundedBox
        args={
          axis === "period"
            ? [length, RAIL.thick, RAIL.width]
            : [RAIL.width, RAIL.thick, length]
        }
        castShadow
        position={middle}
        radius={0.028}
        receiveShadow
        smoothness={5}
      >
        <meshPhysicalMaterial
          clearcoat={0.4}
          clearcoatRoughness={0.3}
          color={INSTRUMENT_COLORS.anodised}
          metalness={0.55}
          roughness={0.36}
        />
      </RoundedBox>
      <mesh
        castShadow
        geometry={arrow}
        position={
          axis === "period"
            ? [0, RAIL_Y, PERIOD_Z + ARROW_OFFSET]
            : [GROUP_X + ARROW_OFFSET, RAIL_Y, GROUP_START_Z + span / 2]
        }
        rotation={[0, axis === "period" ? 0 : -Math.PI / 2, 0]}
      >
        <MetalMaterial color={INSTRUMENT_COLORS.brass} roughness={0.26} />
      </mesh>

      {Arr.map(samples, (sample, sampleIndex) => (
        <TrendMarker
          key={`${axis}-${sample.symbol}`}
          position={markerPoints[sampleIndex]}
          sample={sample}
        />
      ))}
    </group>
  );
}

/** A flat arrow `length` long, lying on y = 0 along x with its middle at the origin, pointing toward +x. */
function arrowGeometry(length: number) {
  const tip = length / 2;
  const neck = tip - ARROW.head;
  const outline = new Shape();
  outline.moveTo(-tip, -ARROW.shaft / 2);
  outline.lineTo(neck, -ARROW.shaft / 2);
  outline.lineTo(neck, -ARROW.headWidth / 2);
  outline.lineTo(tip, 0);
  outline.lineTo(neck, ARROW.headWidth / 2);
  outline.lineTo(neck, ARROW.shaft / 2);
  outline.lineTo(-tip, ARROW.shaft / 2);
  outline.closePath();
  const geometry = new ExtrudeGeometry(outline, {
    bevelEnabled: true,
    bevelSegments: 2,
    bevelSize: 0.003,
    bevelThickness: 0.003,
    depth: ARROW.thick,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/**
 * Renders one element marker with the symbol attached to the visible face.
 */
function TrendMarker({
  position,
  sample,
}: {
  position: ScenePoint;
  sample: PeriodicPropertySample;
}) {
  const { color, mode, range } = usePeriodicPropertiesScene();
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
          <sphereGeometry args={[radius, 64, 48]} />
          <meshPhysicalMaterial
            clearcoat={1}
            clearcoatRoughness={0.06}
            color={color}
            ior={1.5}
            roughness={0.22}
          />
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
      <RoundedBox
        args={[PILLAR_RADIUS * 2, height, PILLAR_RADIUS * 2]}
        castShadow
        position={[0, height / 2, 0]}
        radius={0.02}
        receiveShadow
        smoothness={4}
      >
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.08}
          color={color}
          ior={1.5}
          roughness={0.24}
        />
      </RoundedBox>
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
 * Centers a row of evenly spaced points around the scene origin.
 */
function getCenteredOffset(index: number, count: number, step: number) {
  return (index - (count - 1) / 2) * step;
}
