import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { VelocityArrow } from "@repo/design-system/components/contents/physics/kinematics/arrow";
import { useSight } from "@repo/design-system/components/contents/physics/kinematics/follow";
import {
  CurlingStone,
  STONE,
} from "@repo/design-system/components/contents/physics/kinematics/sling/stone";
import type { ReleasePoint } from "@repo/design-system/components/contents/physics/kinematics/sling/whirl";
import {
  RELEASE_ANGLES,
  ReleasePointSchema,
  releaseTime,
  slingPlace,
  whirl,
} from "@repo/design-system/components/contents/physics/kinematics/sling/whirl";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { useTimeline } from "@repo/design-system/components/contents/simulation/timeline";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { Sweep, Turn } from "@repo/design-system/components/three/form/part";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { Matter } from "@repo/design-system/components/three/matter/material";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { SurfaceMaterial } from "@repo/design-system/components/three/surface/material";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { getColor } from "@repo/design-system/lib/color";
import { RINK_COLORS } from "@repo/design-system/lib/material/rink";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Schema } from "effect";
import type { ReactNode } from "react";
import { Suspense, useMemo, useRef, useState } from "react";
import type { Group } from "three";

/** How far the freed stone is followed after release, in string lengths: it stays in view. */
const FLIGHT = 0.3;

/** Simulated seconds per wall second: the whirl is slowed so the release can be seen. */
const PLAY_RATE = 0.4;

/**
 * The way the camera looks at the rink: down on it by 48 degrees from the
 * side the learner stands on, a little from the right, through an angle of
 * view of 36 degrees.
 */
const LINE = [-0.09, -0.743, -0.669] as const;
const VIEW = 36;

/** How long one m/s of the stone's speed is drawn, in string lengths. */
const SPEED_UNIT = 0.11;

/** How many places around the circle the frame is fitted to. */
const AROUND = 16;

/**
 * The stake the string turns on, as an outline turned about its axis: a
 * plate frozen into the ice, the pin, and the ball on its top that keeps the
 * loop of the string on.
 */
const STAKE = [
  [0, 0],
  [0.052, 0],
  [0.045, 0.012],
  [0.013, 0.012],
  [0.011, STONE.eye + 0.008],
  [0.017, STONE.eye + 0.022],
  [0.012, STONE.eye + 0.036],
  [0, STONE.eye + 0.039],
] as const;

/** How high over the ice the arrows are drawn, in metres. */
const ARROWS = 0.3;

interface StringWhirlReleaseLabProps {
  description: NonNullable<ReactNode>;
  labels: {
    acceleration: ReactNode;
    chooseRelease: string;
    period: ReactNode;
    radius: ReactNode;
    releases: Record<ReleasePoint, ReactNode>;
    speed: ReactNode;
    viewLabel: string;
  };
  /** The time for one turn, in seconds. */
  period: number;
  /** The length of the string, in metres. */
  radius: number;
  title: NonNullable<ReactNode>;
}

/**
 * A stone whirled on a string over smooth ice, let go at a point the
 * learner picks. While it turns, its velocity (teal) stays tangent and its
 * acceleration (fuchsia) points to the centre; once let go, nothing pulls it
 * in, so it slides straight along the tangent of the point of release.
 */
export function StringWhirlReleaseLab({
  description,
  labels,
  period,
  radius,
  title,
}: StringWhirlReleaseLabProps) {
  const [release, setRelease] = useState<ReleasePoint>("north");
  const quantity = useQuantity();
  const motion = whirl(radius, period);
  const isRelease = Schema.is(ReleasePointSchema);

  return (
    <VisualCard
      onReset={() => {
        setRelease("north");
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseRelease}
          gridColumns="4"
          onValueChange={(value) => {
            if (isRelease(value)) {
              setRelease(value);
            }
          }}
          type="single"
          value={release}
          variant="outline"
        >
          {Arr.map(ReleasePointSchema.literals, (point) => (
            <ToggleGroupItem key={point} value={point}>
              {labels.releases[point]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage
          floor={0}
          frameloop="always"
          ground="snow"
          reach={radius * 5}
          setting="field"
        >
          <Suspense fallback={null}>
            <RinkCamera period={period} radius={radius} release={release} />
            <WhirlScene period={period} radius={radius} release={release} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.radius}
            value={<InlineMath math={quantity(radius, "\\text{ m}", 2)} />}
          />
          <VisualFactTabular
            label={labels.period}
            value={<InlineMath math={quantity(period, "\\text{ s}", 2)} />}
          />
          <VisualFactTabular
            label={labels.speed}
            value={
              <span style={{ color: PLOT_COLORS.teal }}>
                <InlineMath
                  math={`v=${quantity(motion.speed, "\\text{ m/s}", 2)}`}
                />
              </span>
            }
          />
          <VisualFactTabular
            label={labels.acceleration}
            value={
              <span style={{ color: PLOT_COLORS.fuchsia }}>
                <InlineMath
                  math={`a=${quantity(motion.acceleration, "\\text{ m/s}^2", 1)}`}
                />
              </span>
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * The frozen pond the stone slides on, lying in the snow that the stage
 * spreads around it and reaching far past the frame.
 */
function Ice({ radius }: { readonly radius: number }) {
  const pond = useMemo(
    () =>
      [
        [radius * 60, 0],
        [0, 0],
      ] as const,
    [radius]
  );

  return (
    <CameraBounds exclude>
      <mesh position={[0, 0.001, 0]} receiveShadow>
        <Turn profile={pond} />
        <Matter color={RINK_COLORS.ice} of="ice" />
      </mesh>
    </CameraBounds>
  );
}

/**
 * The camera over the rink: it looks down on the circle from the side the
 * learner stands on, from as near as the frame allows while it holds the
 * whole circle and the freed stone with its arrow, as far as the stone is
 * followed along the tangent of the point of release.
 */
function RinkCamera({
  period,
  radius,
  release,
}: {
  readonly period: number;
  readonly radius: number;
  readonly release: ReleasePoint;
}) {
  const points = useMemo(() => {
    const letGo = RELEASE_ANGLES[release];
    const flown =
      (FLIGHT + whirl(radius, period).speed * SPEED_UNIT + 0.22) * radius;
    return Arr.append(
      Arr.makeBy(AROUND, (index) => {
        const around = (index / AROUND) * 2 * Math.PI;
        return [
          radius * 1.08 * Math.cos(around),
          0,
          radius * 1.08 * Math.sin(around),
        ] as const;
      }),
      [
        radius * Math.cos(letGo) - flown * Math.sin(letGo),
        ARROWS,
        -radius * Math.sin(letGo) - flown * Math.cos(letGo),
      ] as const
    );
  }, [period, radius, release]);
  const sight = useSight(points, LINE, VIEW);

  return (
    <CameraControls
      cameraPosition={sight.position}
      cameraTarget={sight.target}
      fov={VIEW}
      maxPolarAngle={Math.PI / 2 - 0.1}
      resetKey={release}
    />
  );
}

/**
 * The ice with the stake the string turns on, the circle the stone keeps to
 * scribed into it, the tangent at the point of release, and the stone on
 * its string with its velocity and its acceleration. East is +x and north
 * runs away from the camera.
 */
function WhirlScene({
  period,
  radius,
  release,
}: {
  readonly period: number;
  readonly radius: number;
  readonly release: ReleasePoint;
}) {
  const stone = useRef<Group>(null);
  const string = useRef<Group>(null);
  const velocity = useRef<Group>(null);
  const pull = useRef<Group>(null);
  const freed = useRef(true);
  const [released, setReleased] = useState(true);
  const motion = whirl(radius, period);
  const end = releaseTime(period, release) + (FLIGHT * radius) / motion.speed;
  const { advance, playing } = useTimeline(0, end / PLAY_RATE);
  const letGo = RELEASE_ANGLES[release];
  const speedArrow = useMemo(
    () => [motion.speed * radius * SPEED_UNIT, 0, 0] as const,
    [motion.speed, radius]
  );
  const pullArrow = useMemo(() => [radius * 0.6, 0, 0] as const, [radius]);
  const rope = useMemo(
    () =>
      [
        [0, 0, 0],
        [radius, 0, 0],
      ] as const,
    [radius]
  );
  // The circle scribed into the ice, as a flat band turned about the stake.
  const scribe = useMemo(
    () =>
      [
        [radius * 1.018, 0],
        [radius * 0.982, 0],
      ] as const,
    [radius]
  );
  const tangent = useMemo(
    () =>
      [
        [radius * Math.cos(letGo), 0.004, -radius * Math.sin(letGo)],
        [
          radius * Math.cos(letGo) - radius * 5 * Math.sin(letGo),
          0.004,
          -radius * Math.sin(letGo) - radius * 5 * Math.cos(letGo),
        ],
      ] as const,
    [letGo, radius]
  );

  useFrame((_, delta) => {
    const run = advance(delta) * PLAY_RATE;
    // A card that stands still shows the last moment before the stone is let go.
    const now =
      !playing && run >= end - 1e-6 ? releaseTime(period, release) - 1e-4 : run;
    const place = slingPlace(radius, period, release, now);
    const around = place.released ? letGo : Math.atan2(place.y, place.x);
    stone.current?.position.set(place.x, 0, -place.y);
    stone.current?.rotation.set(0, around + Math.PI, 0);
    string.current?.position.set(place.x, STONE.eye, -place.y);
    string.current?.rotation.set(
      0,
      place.released ? letGo - Math.PI / 2 : around + Math.PI,
      place.released ? -Math.asin((STONE.eye - 0.01) / radius) : 0
    );
    velocity.current?.position.set(place.x, ARROWS, -place.y);
    velocity.current?.rotation.set(0, around + Math.PI / 2, 0);
    pull.current?.position.set(place.x, ARROWS, -place.y);
    pull.current?.rotation.set(0, around + Math.PI, 0);
    if (freed.current !== place.released) {
      freed.current = place.released;
      setReleased(place.released);
    }
  });

  return (
    <>
      <SimulationTicker running={playing} />
      <Ice radius={radius} />
      <mesh position={[0, 0.003, 0]} receiveShadow>
        <Turn profile={scribe} />
        <SurfaceMaterial
          color={RINK_COLORS.scribe}
          repeat={[40, 1]}
          roughness={0.7}
          surface="paint"
        />
      </mesh>
      <CameraBounds exclude>
        <Line
          color={PLOT_COLORS.teal}
          dashed
          dashSize={radius * 0.09}
          gapSize={radius * 0.07}
          lineWidth={2.5}
          opacity={0.85}
          points={tangent}
          transparent
        />
      </CameraBounds>
      <mesh castShadow receiveShadow>
        <Turn profile={STAKE} />
        <SurfaceMaterial
          color={RINK_COLORS.steel}
          metalness={0.85}
          repeat={[1, 2]}
          roughness={0.38}
          surface="brushed"
        />
      </mesh>
      <group ref={string}>
        <mesh castShadow>
          <Sweep path={rope} radius={0.011} />
          <SurfaceMaterial
            color={RINK_COLORS.rope}
            repeat={[1, 30]}
            roughness={0.9}
            surface="cloth"
          />
        </mesh>
      </group>
      <group ref={stone}>
        <CurlingStone />
      </group>
      <group ref={velocity}>
        <VelocityArrow
          color={PLOT_COLORS.teal}
          from={ORIGIN}
          thick={radius * 0.016}
          to={speedArrow}
        />
        <ThreeLabel
          color={PLOT_COLORS.teal}
          fontSize="compact"
          outlineColor={getColor("SLATE", 50)}
          outlineWidth={0.05}
          position={[speedArrow[0] + radius * 0.14, 0.02, 0]}
        >
          <InlineMath math="v" />
        </ThreeLabel>
      </group>
      <group ref={pull} visible={!released}>
        <VelocityArrow
          color={PLOT_COLORS.fuchsia}
          from={ORIGIN}
          thick={radius * 0.016}
          to={pullArrow}
        />
        {released ? null : (
          <ThreeLabel
            color={PLOT_COLORS.fuchsia}
            fontSize="compact"
            outlineColor={getColor("SLATE", 50)}
            outlineWidth={0.05}
            position={[pullArrow[0] * 0.92, 0.02, -radius * 0.2]}
          >
            <InlineMath math="a" />
          </ThreeLabel>
        )}
      </group>
    </>
  );
}

/** The foot of an arrow in its own frame. */
const ORIGIN = [0, 0, 0] as const;
