import { Line } from "@react-three/drei";
import { useCalculusColors } from "@repo/design-system/components/contents/mathematics/palette";
import type { RevolutionProfile } from "@repo/design-system/components/contents/mathematics/revolution/model";
import { evaluateSolidRevolution } from "@repo/design-system/components/contents/mathematics/revolution/model";
import { ParameterSweep } from "@repo/design-system/components/contents/mathematics/sweep";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { ArrowHelper } from "@repo/design-system/components/three/arrow";
import { GRAPH_FULL_CIRCLE_SEGMENTS } from "@repo/design-system/components/three/data/quality";
import { GraphTag } from "@repo/design-system/components/three/tag";
import { Array as Arr } from "effect";
import type { ComponentProps } from "react";
import { useMemo } from "react";
import { DoubleSide, Vector2 } from "three";

/**
 * World units of one mathematical unit. The lab passes the same scale to its
 * coordinate system, so the radius the footer reads is the one the ticks show.
 */
export const REVOLUTION_SCALE = { x: 1.4, y: 1.4, z: 1.4 } as const;
const UNIT = REVOLUTION_SCALE.x;
/** Half of the solid's length along its axis, in world units. */
const HALF_LENGTH = 1.6;
const PROFILE_SAMPLES = 64;
/** The stations along the axis that carry a ring, the edges that give the solid its form. */
const RING_STATIONS = [0, 0.25, 0.5, 0.75, 1] as const;

/** The shape of each profile along the axis, from one end (0) to the other (1). */
function profileShape(profile: RevolutionProfile, t: number): number {
  if (profile === "paraboloid") {
    return 0.25 + Math.sqrt(t) * 1.15;
  }
  if (profile === "trumpetHorn") {
    return 1.35 / (1 + t * 1.35);
  }
  if (profile === "washerBowl") {
    return 0.72 + Math.sin(t * Math.PI * 0.65) * 0.65;
  }
  return 0.5 + t * 0.85;
}

/** One arc about the X axis at a station and a radius, swept from the profile's plane away from the camera. */
function ring(x: number, radius: number, sweep: number) {
  return Arr.makeBy(GRAPH_FULL_CIRCLE_SEGMENTS + 1, (i) => {
    const turn = (i / GRAPH_FULL_CIRCLE_SEGMENTS) * sweep;
    return [x, radius * Math.cos(turn), -radius * Math.sin(turn)] as const;
  });
}

export function SolidOfRevolutionScene({
  parts,
  profile,
  sweep,
  sweepAngle,
}: {
  readonly parts: Readonly<
    Record<
      | "crossSectionDisk"
      | "profileCurve"
      | "radiusArrow"
      | "revolvedShell"
      | "rotationAxis",
      string
    >
  >;
  readonly profile: RevolutionProfile;
  readonly sweep: Omit<ComponentProps<typeof ParameterSweep>, "value">;
  readonly sweepAngle: number;
}) {
  const colors = useCalculusColors();
  const quantity = useQuantity();
  const metrics = evaluateSolidRevolution(profile, sweepAngle);
  const turn = (Math.min(360, Math.max(0, sweepAngle)) * Math.PI) / 180;
  // The profile is sized so its radius at the middle station is the model's outer radius.
  const size = (metrics.outerRadius * UNIT) / profileShape(profile, 0.5);
  const outer = metrics.outerRadius * UNIT;
  const inner = metrics.innerRadius * UNIT;

  const samples = useMemo(
    () =>
      Arr.makeBy(PROFILE_SAMPLES + 1, (i) => {
        const t = i / PROFILE_SAMPLES;
        return {
          radius: profileShape(profile, t) * size,
          x: -HALF_LENGTH + t * HALF_LENGTH * 2,
        };
      }),
    [profile, size]
  );
  const lathe = useMemo(
    () => Arr.map(samples, ({ radius, x }) => new Vector2(radius, x)),
    [samples]
  );
  // The profile in its own plane, and again where the sweep has carried it.
  const meridians = Arr.map([0, turn], (angle) =>
    Arr.map(
      samples,
      ({ radius, x }) =>
        [x, radius * Math.cos(angle), -radius * Math.sin(angle)] as const
    )
  );
  const end = Arr.lastNonEmpty(
    Arr.prepend(samples, { radius: outer, x: HALF_LENGTH })
  );

  return (
    <group>
      <ParameterSweep {...sweep} value={sweepAngle} />
      {/* The swept surface: an unlit, see-through skin that its rings and meridians outline */}
      <mesh rotation={[0, 0, -Math.PI / 2]}>
        <latheGeometry
          args={[lathe, GRAPH_FULL_CIRCLE_SEGMENTS, Math.PI, turn]}
        />
        <meshBasicMaterial
          color={colors.curve}
          depthWrite={false}
          opacity={0.16}
          side={DoubleSide}
          toneMapped={false}
          transparent
        />
      </mesh>
      {Arr.map(RING_STATIONS, (station) => (
        <Line
          color={colors.curve}
          key={station}
          lineWidth={1.6}
          points={ring(
            -HALF_LENGTH + station * HALF_LENGTH * 2,
            profileShape(profile, station) * size,
            turn
          )}
        />
      ))}
      {inner > 0
        ? Arr.map([-HALF_LENGTH, HALF_LENGTH], (x) => (
            <Line
              color={colors.curve}
              key={x}
              lineWidth={1.4}
              points={ring(x, inner, turn)}
            />
          ))
        : null}
      <Line color={colors.curve} lineWidth={1.6} points={meridians[1] ?? []} />
      <Line color={colors.accent} lineWidth={3.4} points={meridians[0] ?? []} />
      {/* The cross-section at the middle station: a disk, or a washer around the bore */}
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <ringGeometry
          args={[inner, outer, GRAPH_FULL_CIRCLE_SEGMENTS, 1, 0, turn]}
        />
        <meshBasicMaterial
          color={colors.cut}
          depthWrite={false}
          opacity={0.34}
          side={DoubleSide}
          toneMapped={false}
          transparent
        />
      </mesh>
      <Line color={colors.cut} lineWidth={2.4} points={ring(0, outer, turn)} />
      {inner > 0 ? (
        <Line color={colors.cut} lineWidth={2} points={ring(0, inner, turn)} />
      ) : null}
      <ArrowHelper
        arrowSize={0.2}
        color={colors.alert}
        from={[0, inner, 0]}
        lineWidth={3}
        to={[0, outer, 0]}
      />
      {/* The axis of rotation, the stretch of the X axis the solid turns about */}
      <Line
        color={colors.ink}
        lineWidth={2.2}
        points={[
          [-HALF_LENGTH - 0.3, 0, 0],
          [HALF_LENGTH + 0.3, 0, 0],
        ]}
      />
      <GraphTag
        anchorX="right"
        anchorY="bottom"
        color={colors.accent}
        gap={0.1}
        math="y = f(x)"
        name={parts.profileCurve}
        position={[end.x, end.radius, 0]}
      />
      <GraphTag
        anchorX="right"
        anchorY="bottom"
        color={colors.alert}
        gap={0.1}
        math={`R = ${quantity(metrics.outerRadius, "", 2)}`}
        name={parts.radiusArrow}
        position={[0, outer, 0]}
      />
      <GraphTag
        anchorX="right"
        anchorY="top"
        color={colors.cut}
        gap={0.14}
        math={`A = ${quantity(metrics.sliceArea, "", 2)}`}
        name={parts.crossSectionDisk}
        position={[0, -outer, 0]}
      />
      <GraphTag
        anchorX="left"
        anchorY="top"
        color={colors.curve}
        gap={0.14}
        math={`V = ${quantity(metrics.sweptVolume, "", 2)}`}
        name={parts.revolvedShell}
        position={[end.x, -end.radius, 0]}
      />
      <GraphTag
        anchorX="right"
        anchorY="top"
        color={colors.ink}
        gap={0.12}
        math="y = 0"
        name={parts.rotationAxis}
        position={[-HALF_LENGTH - 0.3, 0, 0]}
      />
    </group>
  );
}
