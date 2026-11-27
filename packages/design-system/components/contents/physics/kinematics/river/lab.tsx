import { Line } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { VelocityArrow } from "@repo/design-system/components/contents/physics/kinematics/arrow";
import { besideArrow } from "@repo/design-system/components/contents/physics/kinematics/beside";
import { useSight } from "@repo/design-system/components/contents/physics/kinematics/follow";
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
import { CameraBounds } from "@repo/design-system/components/three/camera/framing";
import { Sweep } from "@repo/design-system/components/three/form/part";
import { ThreeLabel } from "@repo/design-system/components/three/label";
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

/** How high over the water the velocity arrows start, in metres: just over the boat's gunwale. */
const ARROWS = 1;

/**
 * How steeply the camera looks down on the river, as the tangent of the
 * angle, and its angle of view, in degrees. It looks down more steeply than
 * half its angle of view, so its frame holds water and banks and never the
 * horizon.
 */
const TILT = Math.tan((50 * Math.PI) / 180);
const VIEW = 40;

/** How much of each bank the frame takes in beyond the waterline, in metres. */
const BANK = 6;

/**
 * How long the boat's own velocity is drawn, as a share of the boat's
 * distance from the camera: the arrows keep their size in the frame while
 * the boat sails away from the camera, as the labels beside them do.
 */
const ARROW_SHARE = 0.2;

/**
 * How far each waterline lies beyond the end of the crossing, in metres.
 * The crossing is measured between the places the middle of the boat puts
 * off from and comes in to, and a boat has length: it floats clear of the
 * bank at both, in open water.
 */
const BERTH = 3.2;

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
  // The ground reaches as far as the furthest landing the slider can ask for.
  const reach = Math.max(
    width,
    Math.abs(riverCrossing(river, -60)?.drift ?? 0),
    Math.abs(riverCrossing(river, 60)?.drift ?? 0)
  );

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
        <ScienceStage frameloop="always" reach={reach} setting="field">
          <Suspense fallback={null}>
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
  const shape = useThree((state) => state.size.width / state.size.height);
  const camera = useThree((state) => state.camera);
  const quantity = useQuantity();
  const crossing = riverCrossing(river, heading);
  const half = river.width / 2;
  const angle = (heading * Math.PI) / 180;
  const drift = crossing?.drift ?? 0;
  const own = useMemo(
    () => [Math.sin(angle), 0, -Math.cos(angle)] as const,
    [angle]
  );
  const sum = useMemo(
    () => [own[0] + river.current / river.boatSpeed, 0, own[2]] as const,
    [own, river.boatSpeed, river.current]
  );
  // The frame holds both banks and the whole crossing, from where the boat
  // puts off to where it lands.
  const shore = half + BERTH + BANK;
  const held = useMemo(
    () =>
      [
        [Math.min(0, drift) - BANK, 0, shore],
        [Math.max(0, drift) + BANK, 0, shore],
        [Math.min(0, drift) - BANK, 2, -shore],
        [Math.max(0, drift) + BANK, 2, -shore],
      ] as const,
    [drift, shore]
  );
  // The camera looks straight across the river and down, so the triangle of
  // the three velocities is seen nearly true. A landing further downstream
  // than the river is wide turns it to look along the river, so the long
  // crossing runs into the frame and not across a strip of it.
  const line = useMemo(() => {
    const lean =
      Math.sign(drift) * Math.max(0, Math.abs(drift) / (2 * half) - 1) * 0.5;
    return [lean, -TILT * Math.hypot(lean, 1), -1] as const;
  }, [drift, half]);
  const sight = useSight(held, line, VIEW);
  // Each value stands outside the triangle, beside the middle of its arrow.
  const sides = useMemo(() => {
    const boat = [own[0], -own[2]] as const;
    const ground = [sum[0], -sum[2]] as const;
    return {
      current: besideArrow(boat, ground, START),
      ground: besideArrow(START, ground, boat),
      own: besideArrow(START, boat, ground),
    };
  }, [own, sum]);
  const landings = useMemo(() => [0, drift] as const, [drift]);
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
      time.run =
        time.run + step > PLAY_SECONDS + HOLD_SECONDS ? 0 : time.run + step;
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
    arrows.current?.scale.setScalar(
      ARROW_SHARE *
        Math.min(1, shape) *
        Math.hypot(
          camera.position.x - x,
          camera.position.y - ARROWS,
          camera.position.z - z
        )
    );
  });

  return (
    <>
      <CameraControls
        cameraPosition={sight.position}
        cameraTarget={sight.target}
        fov={VIEW}
        maxPolarAngle={Math.PI / 2 - 0.2}
        resetKey={heading}
      />
      <Sea level={0} swell={0.8} />
      <CameraBounds exclude>
        <mesh>
          <Sweep flat={SHEET} path={silt} radius={half + BERTH + 4} />
          <meshBasicMaterial
            color={BOAT_COLORS.silt}
            depthWrite={false}
            opacity={0.42}
            transparent
          />
        </mesh>
      </CameraBounds>
      <Banks landings={landings} width={river.width + 2 * BERTH} />
      <Flotsam current={river.current} width={river.width} />
      <Line
        color={getColor("WHITE")}
        dashed
        dashSize={1.6}
        gapSize={1.1}
        lineWidth={2.5}
        opacity={0.85}
        points={path}
        transparent
      />
      <Skiff color={BOAT_COLORS.hullPaint} level={0} ref={skiff} />
      <group ref={arrows}>
        <VelocityArrow
          color={PLOT_COLORS.teal}
          from={ORIGIN}
          thick={0.024}
          to={own}
        />
        <ThreeLabel
          anchorX={sides.own.anchorX}
          anchorY={sides.own.anchorY}
          color={PLOT_COLORS.teal}
          fontSize="compact"
          gap={0.25}
          outlineColor={getColor("SLATE", 50)}
          outlineWidth={0.05}
          position={[sides.own.middle[0], 0, -sides.own.middle[1]]}
        >
          <InlineMath math={quantity(river.boatSpeed, "\\text{ m/s}", 1)} />
        </ThreeLabel>
        <VelocityArrow
          color={PLOT_COLORS.amber}
          from={own}
          thick={0.024}
          to={sum}
        />
        <ThreeLabel
          anchorX={sides.current.anchorX}
          anchorY={sides.current.anchorY}
          color={PLOT_COLORS.amber}
          fontSize="compact"
          gap={0.25}
          outlineColor={getColor("SLATE", 50)}
          outlineWidth={0.05}
          position={[sides.current.middle[0], 0, -sides.current.middle[1]]}
        >
          <InlineMath math={quantity(river.current, "\\text{ m/s}", 1)} />
        </ThreeLabel>
        <VelocityArrow
          color={PLOT_COLORS.violet}
          from={ORIGIN}
          thick={0.03}
          to={sum}
        />
        <ThreeLabel
          anchorX={sides.ground.anchorX}
          anchorY={sides.ground.anchorY}
          color={PLOT_COLORS.violet}
          fontSize="compact"
          gap={0.25}
          outlineColor={getColor("SLATE", 50)}
          outlineWidth={0.05}
          position={[sides.ground.middle[0], 0, -sides.ground.middle[1]]}
        >
          <InlineMath
            math={quantity(crossing?.speed ?? 0, "\\text{ m/s}", 2)}
          />
        </ThreeLabel>
      </group>
    </>
  );
}

/**
 * The silt a lowland river carries, as a sheet of tint that lies on the
 * water from bank to bank along the whole river: a ribbon thin as a film,
 * its broad face up.
 */
const SHEET = [0.0001, [0, 1, 0]] as const;
const silt = [
  [-2000, 0.02, 0],
  [2000, 0.02, 0],
] as const;

/** Where the boat's arrows start, on the plane its velocity triangle is drawn in. */
const START = [0, 0] as const;

/** The boat's own place in the frame its arrows are drawn in. */
const ORIGIN = [0, 0, 0] as const;
