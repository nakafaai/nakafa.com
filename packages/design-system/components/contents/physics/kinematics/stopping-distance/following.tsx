import { useFrame } from "@react-three/fiber";
import { FollowCamera } from "@repo/design-system/components/contents/physics/kinematics/follow";
import {
  DistancePosts,
  ROAD,
  Road,
} from "@repo/design-system/components/contents/physics/kinematics/road";
import {
  SEDAN,
  Sedan,
  type SedanRig,
} from "@repo/design-system/components/contents/physics/kinematics/sedan";
import {
  contactOf,
  type Follow,
  finalGap,
  followerStop,
  initialGap,
  leadStop,
  settleTime,
} from "@repo/design-system/components/contents/physics/kinematics/stopping-distance/gap";
import {
  reactionDistance,
  stopPosition,
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
import { Slider } from "@repo/design-system/components/ui/slider";
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
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr, Option } from "effect";
import {
  type ReactNode,
  Suspense,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

/** Both cars cruise at 25 m/s, 90 km/h, as on a toll road. */
const SPEED = 25;

/** Both brake as hard as the lesson's car: 5 m/s². */
const DECELERATION = 5;

/** The time gaps the learner can leave, in seconds. */
const HEADWAYS = [1, 2, 3] as const;

/** The reaction times the slider spans, in seconds. */
const REACTION = { max: 2.5, min: 0.5, step: 0.1 } as const;

/** Seconds of cruising shown before the front car brakes. */
const LEAD_IN = 1.5;

/** The camera watches from the verge, 24 m out and 4.5 m up. */
const CAMERA_OFFSET = [-5, 4.5, 24] as const;

/** From the rear car's origin to the front car's origin at a bumper gap of zero. */
const BUMPER_TO_BUMPER = SEDAN.length + 0.06;

/**
 * Two cars at 90 km/h on one lane. The car in front brakes hard; the
 * learner's car behind brakes just as hard, but only after the driver's
 * reaction time. The learner picks the time gap and the reaction time and
 * sees whether the gap survives: it shrinks by exactly the road covered while
 * the driver reacted, so a gap shorter in time than the reaction ends in a
 * crash at any speed.
 */
export function FollowingDistanceLab({
  description,
  labels,
  title,
}: {
  readonly description: ReactNode;
  readonly labels: {
    readonly chooseHeadway: string;
    readonly crash: ReactNode;
    readonly finalGap: ReactNode;
    readonly impactSpeed: ReactNode;
    readonly initialGap: ReactNode;
    readonly reactionDistance: ReactNode;
    readonly reactionTime: string;
    readonly safe: ReactNode;
    readonly viewLabel: string;
  };
  readonly title: ReactNode;
}) {
  const [headway, setHeadway] = useState<(typeof HEADWAYS)[number]>(2);
  const [reaction, setReaction] = useState(1.5);
  const quantity = useQuantity();
  const follow = useMemo<Follow>(
    () => ({ deceleration: DECELERATION, headway, reaction, speed: SPEED }),
    [headway, reaction]
  );
  const contact = contactOf(follow);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardToolbar>
        <ToggleGroup
          aria-label={labels.chooseHeadway}
          onValueChange={(value: string) => {
            Option.map(
              Arr.findFirst(HEADWAYS, (each) => String(each) === value),
              setHeadway
            );
          }}
          type="single"
          value={String(headway)}
          variant="outline"
        >
          {Arr.map(HEADWAYS, (each) => (
            <ToggleGroupItem key={each} value={String(each)}>
              <InlineMath math={quantity(each, UNIT.time, 0)} />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span>{labels.reactionTime}</span>
            <InlineMath math={quantity(reaction, UNIT.time)} />
          </div>
          <Slider
            aria-label={labels.reactionTime}
            max={REACTION.max}
            min={REACTION.min}
            onValueChange={setReaction}
            step={REACTION.step}
            value={reaction}
          />
        </div>
      </VisualCardToolbar>

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={60} setting="field">
          <Suspense fallback={null}>
            <FollowingScene follow={follow} />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardSceneActions />

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.initialGap}
            value={
              <InlineMath math={quantity(initialGap(follow), UNIT.length)} />
            }
          />
          <VisualFactTabular
            label={labels.reactionDistance}
            value={
              <InlineMath
                math={quantity(
                  reactionDistance(followerStop(follow)),
                  UNIT.length
                )}
              />
            }
          />
          {Option.match(contact, {
            onNone: () => (
              <VisualFactTabular
                label={labels.finalGap}
                value={
                  <>
                    <InlineMath
                      math={quantity(finalGap(follow), UNIT.length)}
                    />{" "}
                    {labels.safe}
                  </>
                }
              />
            ),
            onSome: (crash) => (
              <VisualFactTabular
                label={labels.impactSpeed}
                value={
                  <>
                    <InlineMath math={quantity(crash.closing, UNIT.speed)} />{" "}
                    {labels.crash}
                  </>
                }
              />
            ),
          })}
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/** Where a car is `time` seconds after the front car braked. */
function placeAt(cruise: number, braked: number, time: number) {
  return time < 0 ? cruise * time : braked;
}

/** The two cars, run by the card's play clock until they stop or touch. */
function FollowingScene({ follow }: { readonly follow: Follow }) {
  const lead = useRef<SedanRig>(null);
  const rear = useRef<SedanRig>(null);
  const middle = useRef(0);
  const contact = contactOf(follow);
  const end = Option.match(contact, {
    onNone: () => settleTime(follow),
    onSome: (crash) => crash.time,
  });
  const { advance, playing } = useTimeline(-LEAD_IN, end);
  const offset = BUMPER_TO_BUMPER + initialGap(follow);

  // The scene moves before the camera that follows it reads where it is.
  useFrame((_, delta) => {
    const time = advance(delta);
    const rearX = placeAt(
      follow.speed,
      stopPosition(followerStop(follow), time),
      time
    );
    const leadX =
      offset +
      placeAt(follow.speed, stopPosition(leadStop(follow), time), time);
    rear.current?.place(rearX, time >= follow.reaction && time < end);
    lead.current?.place(leadX, time >= 0 && time < end);
    middle.current = (rearX + leadX) / 2;
  }, -1);

  const watch = useCallback(() => middle.current, []);

  return (
    <>
      <SimulationTicker running={playing} />
      <FollowCamera
        depth={ROAD.lane}
        follow={watch}
        maxDistance={140}
        minDistance={10}
        offset={CAMERA_OFFSET}
      />
      <Road from={-300} surface="dry" to={offset + 600} />
      <DistancePosts posts={Arr.map(Arr.range(1, 14), (index) => index * 10)} />
      <group position={[0, 0, ROAD.lane]}>
        <Sedan color={MATERIAL.carPaintDark} ref={lead} />
        <Sedan color={MATERIAL.carPaint} ref={rear} />
      </group>
    </>
  );
}
