import { useFrame } from "@react-three/fiber";
import { FollowCamera } from "@repo/design-system/components/contents/physics/kinematics/follow";
import {
  ROAD,
  Road,
} from "@repo/design-system/components/contents/physics/kinematics/road";
import {
  Sedan,
  type SedanRig,
} from "@repo/design-system/components/contents/physics/kinematics/sedan";
import {
  brakingDistance,
  reactionDistance,
  type Stop,
  stopPhase,
  stopPosition,
  stoppingDistance,
  stoppingTime,
} from "@repo/design-system/components/contents/physics/kinematics/stopping-distance/motion";
import {
  UNIT,
  useQuantity,
} from "@repo/design-system/components/contents/simulation/quantity";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { useTimeline } from "@repo/design-system/components/contents/simulation/timeline";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
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
import { VisualFactIndicator } from "@repo/design-system/components/visual/fact";
import { VisualCardSceneActions } from "@repo/design-system/components/visual/scene";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Option } from "effect";
import {
  type ReactNode,
  Suspense,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { MATERIAL } from "@repo/design-system/lib/material";

/** The speeds of the lesson's table, in m/s. */
const SPEEDS = [10, 20, 30] as const;

/** The lesson's driver: one second to react, then 5 m/s² of braking. */
const REACTION = 1;
const DECELERATION = 5;

/** Seconds of driving shown before the hazard appears. */
const LEAD_IN = 1.2;

/** The road the reaction covers is teal and the braking is orange, as in the lesson. */
const REACTION_COLOR = PLOT_COLORS.teal;
const BRAKING_COLOR = PLOT_COLORS.orange;

/** The camera rides 6 m behind, 2.6 m up and 10 m beside the car. */
const CAMERA_OFFSET = [-6, 2.6, 10] as const;

/**
 * A car meets a hazard at the white line. For one second its driver reacts
 * and the car rolls on at full speed over the teal stretch; then it brakes at
 * 5 m/s² over the orange stretch to rest. The learner picks the speed and
 * sees the reaction distance grow with v and the braking distance with v².
 */
export function StoppingDistanceLab({
  description,
  labels,
  title,
}: {
  readonly description: ReactNode;
  readonly labels: {
    readonly brakingDistance: ReactNode;
    readonly chooseSpeed: string;
    readonly reactionDistance: ReactNode;
    readonly speed: ReactNode;
    readonly stoppingDistance: ReactNode;
    readonly viewLabel: string;
  };
  readonly title: ReactNode;
}) {
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(20);
  const quantity = useQuantity();
  const stop = useMemo<Stop>(
    () => ({ deceleration: DECELERATION, reaction: REACTION, speed }),
    [speed]
  );

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseSpeed}
          onValueChange={(value: string) => {
            Option.map(
              Arr.findFirst(SPEEDS, (each) => String(each) === value),
              setSpeed
            );
          }}
          type="single"
          value={String(speed)}
          variant="outline"
        >
          {Arr.map(SPEEDS, (each) => (
            <ToggleGroupItem key={each} value={String(each)}>
              <InlineMath math={quantity(each, UNIT.speed, 0)} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage setting="field" reach={40}>
          <Suspense fallback={null}>
            <StopScene stop={stop} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactIndicator
            label={labels.speed}
            value={<InlineMath math={quantity(speed, UNIT.speed, 0)} />}
          />
          <VisualFactIndicator
            indicatorColor={REACTION_COLOR}
            label={labels.reactionDistance}
            value={
              <InlineMath
                math={quantity(reactionDistance(stop), UNIT.length)}
              />
            }
          />
          <VisualFactIndicator
            indicatorColor={BRAKING_COLOR}
            label={labels.brakingDistance}
            value={
              <InlineMath math={quantity(brakingDistance(stop), UNIT.length)} />
            }
          />
          <VisualFactIndicator
            label={labels.stoppingDistance}
            value={
              <InlineMath
                math={quantity(stoppingDistance(stop), UNIT.length)}
              />
            }
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/** Where the car is `time` seconds after the hazard appeared. */
function carAt(stop: Stop, time: number) {
  return time < 0 ? stop.speed * time : stopPosition(stop, time);
}

/**
 * A stretch of road painted in a translucent colour, from `from` to `to`
 * metres, across the car's lane.
 */
function Stretch({
  color,
  from,
  to,
}: {
  readonly color: string;
  readonly from: number;
  readonly to: number;
}) {
  return (
    <mesh
      position={[(from + to) / 2, 0.008, ROAD.lane]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[Math.max(0.01, to - from), 3.1]} />
      <meshBasicMaterial
        color={color}
        depthWrite={false}
        opacity={0.55}
        transparent
      />
    </mesh>
  );
}

/** The road, the two painted stretches and the car, run by the play clock. */
function StopScene({ stop }: { readonly stop: Stop }) {
  const car = useRef<SedanRig>(null);
  const shown = useRef(stoppingDistance(stop));
  const { advance, playing } = useTimeline(-LEAD_IN, stoppingTime(stop));
  const reactionEnd = reactionDistance(stop);
  const end = stoppingDistance(stop);

  // The scene moves before the camera that follows it reads where it is.
  useFrame((_, delta) => {
    const time = advance(delta);
    const x = carAt(stop, time);
    shown.current = x;
    car.current?.place(x, time >= 0 && stopPhase(stop, time) === "braking");
  }, -1);

  const follow = useCallback(() => shown.current, []);

  return (
    <>
      <SimulationTicker running={playing} />
      <FollowCamera
        depth={ROAD.lane}
        follow={follow}
        lookAhead={3}
        maxDistance={90}
        minDistance={6}
        offset={CAMERA_OFFSET}
      />
      <Road
        from={-300}
        posts={Arr.appendAll(
          Arr.map(Arr.range(1, 6), (index) => index * 10),
          Arr.map(Arr.range(4, 6), (index) => index * 20)
        )}
        surface="dry"
        to={600}
      />
      <Stretch color={REACTION_COLOR} from={0} to={reactionEnd} />
      <Stretch color={BRAKING_COLOR} from={reactionEnd} to={end} />
      <group position={[0, 0, ROAD.lane]}>
        <Sedan color={MATERIAL.carPaint} ref={car} />
      </group>
    </>
  );
}
