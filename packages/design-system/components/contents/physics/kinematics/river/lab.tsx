import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { VelocityArrow } from "@repo/design-system/components/contents/physics/kinematics/arrow";
import { Banks } from "@repo/design-system/components/contents/physics/kinematics/river/bank";
import type { River } from "@repo/design-system/components/contents/physics/kinematics/river/crossing";
import {
  RiverSchema,
  riverCrossing,
} from "@repo/design-system/components/contents/physics/kinematics/river/crossing";
import { Flotsam } from "@repo/design-system/components/contents/physics/kinematics/river/flotsam";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Sea } from "@repo/design-system/components/three/stage/sea";
import type { SkiffRig } from "@repo/design-system/components/three/vehicle/skiff";
import { Skiff } from "@repo/design-system/components/three/vehicle/skiff";
import {
  useVisualScene,
  useVisualStop,
  VisualCard,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardHeader,
  VisualCardToolbar,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { VisualSlider } from "@repo/design-system/components/visual/slider";
import { getColor } from "@repo/design-system/lib/color";
import { BOAT_COLORS } from "@repo/design-system/lib/material/boat";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Schema } from "effect";
import type { ReactNode } from "react";
import { Suspense, useMemo, useRef, useState } from "react";
import type { Group } from "three";

/** How long one crossing plays, in wall seconds. */
const PLAY_SECONDS = 7;

/** How long the boat rests on the far bank before it crosses again, in wall seconds. */
const HOLD_SECONDS = 1.6;

/** How far into the crossing the boat is shown before the card plays. */
const STILL = 0.55;

/** How high over the water the velocity arrows are drawn, in metres. */
const ARROWS = 2.4;

interface RiverBoatCrossingLabProps {
  /** The boat's speed through the water, in m/s. */
  boatSpeed: number;
  /** The speed of the current, in m/s. */
  current: number;
  description: NonNullable<ReactNode>;
  /** The heading the boat starts with, in degrees from straight across, negative upstream. */
  heading?: number;
  labels: {
    angle: ReactNode;
    drift: ReactNode;
    groundSpeed: ReactNode;
    heading: ReactNode;
    headingName: string;
    time: ReactNode;
    viewLabel: string;
  };
  title: NonNullable<ReactNode>;
  /** The width of the river, in metres. */
  width: number;
}

/**
 * A boat crossing a flowing river. The learner turns the boat's heading: its
 * own velocity (teal) and the current (amber) add tip to tail into its
 * velocity over the ground (violet), which sets how long the crossing takes
 * and how far downstream it lands.
 */
export function RiverBoatCrossingLab({
  boatSpeed,
  current,
  description,
  heading: initial = 0,
  labels,
  title,
  width,
}: RiverBoatCrossingLabProps) {
  const [heading, setHeading] = useState(initial);
  const quantity = useQuantity();
  const river = useMemo(
    () => Schema.decodeSync(RiverSchema)({ boatSpeed, current, width }),
    [boatSpeed, current, width]
  );
  const crossing = riverCrossing(river, heading);

  return (
    <VisualCard
      onReset={() => {
        setHeading(initial);
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <VisualSlider
          heading={labels.heading}
          label={labels.headingName}
          max={60}
          min={-60}
          onValueChange={setHeading}
          readout={<InlineMath math={`${quantity(heading, "^\\circ", 0)}`} />}
          step={1}
          value={heading}
        />
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage frameloop="always" reach={width * 0.75} setting="field">
          <Suspense fallback={null}>
            <CameraControls
              cameraPosition={[-width * 0.42, width * 0.36, width * 0.98]}
              cameraTarget={[width * 0.2, 0, -width * 0.05]}
              fov={38}
              maxDistance={width * 2.4}
              maxPolarAngle={Math.PI / 2 - 0.08}
              minDistance={8}
            />
            <RiverScene heading={heading} river={river} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.groundSpeed}
            value={
              <InlineMath
                math={quantity(crossing?.speed ?? 0, "\\text{ m/s}", 2)}
              />
            }
          />
          <VisualFactTabular
            label={labels.angle}
            value={
              <InlineMath math={quantity(crossing?.angle ?? 0, "^\\circ", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.time}
            value={
              <InlineMath
                math={quantity(crossing?.time ?? 0, "\\text{ s}", 1)}
              />
            }
          />
          <VisualFactTabular
            label={labels.drift}
            value={
              <InlineMath
                math={quantity(crossing?.drift ?? 0, "\\text{ m}", 1)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * The river, its banks, what drifts on the current, and the boat with its
 * three velocities. East, downstream, is +x; the boat leaves the near bank
 * at +z and lands on the far bank at -z.
 */
function RiverScene({
  heading,
  river,
}: {
  readonly heading: number;
  readonly river: River;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const skiff = useRef<SkiffRig>(null);
  const arrows = useRef<Group>(null);
  const clock = useRef({ run: STILL * PLAY_SECONDS, water: 0 });
  const crossing = riverCrossing(river, heading);
  const half = river.width / 2;
  const angle = (heading * Math.PI) / 180;
  // One metre per second is drawn as this many metres of arrow.
  const scale = river.width * 0.07;
  const own = useMemo(
    () =>
      [
        Math.sin(angle) * river.boatSpeed * scale,
        0,
        -Math.cos(angle) * river.boatSpeed * scale,
      ] as const,
    [angle, river.boatSpeed, scale]
  );
  const sum = useMemo(
    () => [own[0] + river.current * scale, 0, own[2]] as const,
    [own, river.current, scale]
  );
  const path = useMemo(
    () =>
      [
        [0, 0.06, half],
        [crossing?.drift ?? 0, 0.06, -half],
      ] as const,
    [crossing?.drift, half]
  );

  useVisualStop(() => {
    clock.current.run = 0;
  });

  useFrame((_, delta) => {
    const step = simulationStep(delta);
    const time = clock.current;
    time.water += step;
    if (playing) {
      time.run = time.run + step > PLAY_SECONDS + HOLD_SECONDS ? 0 : time.run + step;
    }
    const share = Math.min(1, time.run / PLAY_SECONDS);
    const now = share * (crossing?.time ?? 0);
    const x = (crossing?.downstream ?? 0) * now;
    const z = half - (crossing?.across ?? 0) * now;
    const moving = crossing !== undefined && share < 1;
    skiff.current?.drive(
      x,
      z,
      Math.PI / 2 - angle,
      moving ? river.boatSpeed : 0,
      time.water
    );
    arrows.current?.position.set(x, ARROWS, z);
  });

  return (
    <>
      <Sea level={0} swell={0.8} />
      <Banks width={river.width} />
      <Flotsam current={river.current} width={river.width} />
      <Line
        color={getColor("WHITE")}
        dashed
        dashSize={river.width * 0.03}
        gapSize={river.width * 0.022}
        lineWidth={2}
        opacity={0.7}
        points={path}
        transparent
      />
      <Skiff color={BOAT_COLORS.hullPaint} level={0} ref={skiff} />
      <group ref={arrows}>
        <VelocityArrow
          color={PLOT_COLORS.teal}
          from={ORIGIN}
          thick={river.width * 0.004}
          to={own}
        />
        <VelocityArrow
          color={PLOT_COLORS.amber}
          from={own}
          thick={river.width * 0.004}
          to={sum}
        />
        <VelocityArrow
          color={PLOT_COLORS.violet}
          from={ORIGIN}
          thick={river.width * 0.005}
          to={sum}
        />
      </group>
    </>
  );
}

/** The boat's own place in the frame its arrows are drawn in. */
const ORIGIN = [0, 0, 0] as const;
