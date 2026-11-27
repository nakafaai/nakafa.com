import { useFrame } from "@react-three/fiber";
import { VelocityArrow } from "@repo/design-system/components/contents/physics/kinematics/arrow";
import { FollowCamera } from "@repo/design-system/components/contents/physics/kinematics/follow";
import { apparentRain } from "@repo/design-system/components/contents/physics/kinematics/rain/drops";
import { carAlong } from "@repo/design-system/components/contents/physics/kinematics/rain/fall";
import type { RainRig } from "@repo/design-system/components/contents/physics/kinematics/rain/streaks";
import { Rain } from "@repo/design-system/components/contents/physics/kinematics/rain/streaks";
import {
  ROAD,
  Road,
} from "@repo/design-system/components/contents/physics/kinematics/road";
import type { SedanRig } from "@repo/design-system/components/contents/physics/kinematics/sedan";
import { Sedan } from "@repo/design-system/components/contents/physics/kinematics/sedan";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/design-system/components/ui/toggle-group";
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
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Schema } from "effect";
import type { ReactNode } from "react";
import { Suspense, useCallback, useMemo, useRef, useState } from "react";
import type { Group } from "three";

/** The two observers a learner can watch the rain from. */
const FrameSchema = Schema.Literals(["ground", "car"]);
type Frame = typeof FrameSchema.Type;

/** Simulated seconds per wall second: the rain is slowed so single drops can be followed. */
const PLAY_RATE = 0.35;

/**
 * The loop of road the car drives, in metres. Watched from the roadside it
 * is short, so the car comes past every few seconds. Followed by the camera
 * it is as long as the road's dashes, trees and lamps take to repeat
 * together, so the road never jumps under the car.
 */
const LOOP = { car: 544, ground: 44 } satisfies Record<Frame, number>;

/** The camera stands 6 m back along the road, 2.3 m up and 10 m out on the verge. */
const CAMERA_OFFSET = [-6, 2.3, 10] as const;

/** Where the velocity triangle starts over the car's roof, and how long one m/s is drawn, in metres. */
const TRIANGLE = [1.4, 4.6, 0] as const;
const UNIT = 0.18;

interface RainDriveRelativeVelocityLabProps {
  /** The car's speed the card starts at, in m/s. */
  car?: number;
  description: NonNullable<ReactNode>;
  labels: {
    angle: ReactNode;
    apparentSpeed: ReactNode;
    carSpeed: ReactNode;
    carSpeedName: string;
    chooseFrame: string;
    frames: Record<Frame, ReactNode>;
    rainSpeed: ReactNode;
    viewLabel: string;
  };
  /** How fast the rain falls, in m/s. */
  rain?: number;
  title: NonNullable<ReactNode>;
}

/**
 * Rain falling straight down on a still day, watched from the roadside or
 * from beside a moving car. The faster the car, the more the rain slants
 * toward the windscreen and the faster it seems to come: its velocity
 * relative to the car is its own velocity minus the car's.
 */
export function RainDriveRelativeVelocityLab({
  car: initialCar = 10,
  description,
  labels,
  rain = 6.5,
  title,
}: RainDriveRelativeVelocityLabProps) {
  const [car, setCar] = useState(initialCar);
  const [frame, setFrame] = useState<Frame>("car");
  const quantity = useQuantity();
  const seen = apparentRain(rain, frame === "car" ? car : 0);
  const isFrame = Schema.is(FrameSchema);

  return (
    <VisualCard
      onReset={() => {
        setCar(initialCar);
        setFrame("car");
      }}
    >
      <VisualCardHeader description={description} title={title} />
      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseFrame}
          gridColumns="2"
          onValueChange={(value) => {
            if (isFrame(value)) {
              setFrame(value);
            }
          }}
          type="single"
          value={frame}
          variant="outline"
        >
          <ToggleGroupItem value="ground">
            {labels.frames.ground}
          </ToggleGroupItem>
          <ToggleGroupItem value="car">{labels.frames.car}</ToggleGroupItem>
        </ToggleGroup>
        <VisualSlider
          heading={labels.carSpeed}
          label={labels.carSpeedName}
          max={25}
          min={0}
          onValueChange={setCar}
          readout={<InlineMath math={quantity(car, "\\text{ m/s}", 0)} />}
          step={1}
          value={car}
        />
      </VisualCardToolbar>
      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage floor={0} frameloop="always" reach={30} setting="field">
          <Suspense fallback={null}>
            <RainScene car={car} frame={frame} rain={rain} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>
      <VisualCardSceneActions />
      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.rainSpeed}
            value={<InlineMath math={quantity(rain, "\\text{ m/s}", 1)} />}
          />
          <VisualFactTabular
            label={labels.apparentSpeed}
            value={
              <InlineMath math={quantity(seen.speed, "\\text{ m/s}", 1)} />
            }
          />
          <VisualFactTabular
            label={labels.angle}
            value={<InlineMath math={quantity(seen.angle, "^\\circ", 0)} />}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/**
 * A wet road in the rain with the car driving along it. From the roadside
 * the camera stands still, the car comes past and the rain hangs straight
 * down; from the car the camera rides beside it, and the same rain leans
 * toward the car. Over the roof stands the velocity triangle: the rain's own
 * velocity down, the car's velocity reversed, and their sum, the rain as
 * the car meets it.
 */
function RainScene({
  car,
  frame,
  rain,
}: {
  readonly car: number;
  readonly frame: Frame;
  readonly rain: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const quantity = useQuantity();
  const sedan = useRef<SedanRig>(null);
  const shower = useRef<RainRig>(null);
  const triangle = useRef<Group>(null);
  const clock = useRef({ driven: 0, fallen: 0, x: 0 });
  const riding = frame === "car";
  const seen = apparentRain(rain, riding ? car : 0);
  const down = useMemo(() => [0, -rain * UNIT, 0] as const, [rain]);
  const back = useMemo(
    () => [-car * UNIT, -rain * UNIT, 0] as const,
    [car, rain]
  );

  useVisualStop(() => {
    clock.current.driven = 0;
    clock.current.fallen = 0;
  });

  // The scene moves before the camera that follows it reads where it is.
  useFrame((_, delta) => {
    const state = clock.current;
    if (playing) {
      const step = simulationStep(delta) * PLAY_RATE;
      state.driven += car * step;
      state.fallen += rain * step;
    }
    state.x = carAlong(state.driven, LOOP[frame]);
    sedan.current?.place(state.x, false);
    triangle.current?.position.set(
      state.x + TRIANGLE[0],
      TRIANGLE[1],
      ROAD.lane + TRIANGLE[2]
    );
    shower.current?.fall(
      riding ? state.x : 0,
      state.fallen,
      seen.speed,
      (seen.angle * Math.PI) / 180
    );
  }, -1);

  const beside = useCallback(() => clock.current.x, []);
  const roadside = useCallback(() => 0, []);

  return (
    <>
      <FollowCamera
        depth={ROAD.lane}
        follow={riding ? beside : roadside}
        lookAhead={1.5}
        maxDistance={60}
        minDistance={6}
        offset={CAMERA_OFFSET}
      />
      <Road from={-340} surface="wet" to={340} />
      <Rain ref={shower} />
      <group position={[0, 0, ROAD.lane]}>
        <Sedan color={PLOT_COLORS.teal} ref={sedan} />
      </group>
      <group ref={triangle}>
        <VelocityArrow
          color={PLOT_COLORS.violet}
          from={ORIGIN}
          thick={0.05}
          to={down}
        />
        <ThreeLabel
          anchorX="left"
          color={PLOT_COLORS.violet}
          fontSize="compact"
          gap={0.12}
          outlineColor={getColor("SLATE", 50)}
          outlineWidth={0.05}
          position={[0, down[1] / 2, 0]}
        >
          <InlineMath math={quantity(rain, "\\text{ m/s}", 1)} />
        </ThreeLabel>
        {riding && car > 0 ? (
          <>
            <VelocityArrow
              color={PLOT_COLORS.amber}
              from={down}
              thick={0.05}
              to={back}
            />
            <ThreeLabel
              anchorY="top"
              color={PLOT_COLORS.amber}
              fontSize="compact"
              gap={0.12}
              outlineColor={getColor("SLATE", 50)}
              outlineWidth={0.05}
              position={[back[0] / 2, back[1], 0]}
            >
              <InlineMath math={quantity(car, "\\text{ m/s}", 0)} />
            </ThreeLabel>
            <VelocityArrow
              color={PLOT_COLORS.fuchsia}
              from={ORIGIN}
              thick={0.065}
              to={back}
            />
            <ThreeLabel
              anchorX="right"
              anchorY="bottom"
              color={PLOT_COLORS.fuchsia}
              fontSize="compact"
              gap={0.12}
              outlineColor={getColor("SLATE", 50)}
              outlineWidth={0.05}
              position={[back[0] / 2, back[1] / 2, 0]}
            >
              <InlineMath math={quantity(seen.speed, "\\text{ m/s}", 1)} />
            </ThreeLabel>
          </>
        ) : null}
      </group>
    </>
  );
}

/** The start of the velocity triangle in its own frame. */
const ORIGIN = [0, 0, 0] as const;
