import { PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import {
  ROAD,
  Road,
} from "@repo/design-system/components/contents/physics/kinematics/road";
import {
  SEDAN,
  Sedan,
  type SedanRig,
} from "@repo/design-system/components/contents/physics/kinematics/sedan";
import {
  type Stop,
  stopPosition,
  stoppingTime,
} from "@repo/design-system/components/contents/physics/kinematics/stopping-distance/motion";
import {
  judgePress,
  keepTrial,
  type Phase,
  summarizeTrials,
  type Trial,
  waitFrom,
} from "@repo/design-system/components/contents/physics/kinematics/stopping-distance/reflex";
import {
  UNIT,
  useQuantity,
} from "@repo/design-system/components/contents/simulation/quantity";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { threeSceneFrameVariants } from "@repo/design-system/components/three/scene";
import { ScienceStage } from "@repo/design-system/components/three/stage";
import { Button } from "@repo/design-system/components/ui/button";
import {
  VisualCard,
  VisualCardActions,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import { VisualFactTabular } from "@repo/design-system/components/visual/fact";
import { MATERIAL } from "@repo/design-system/lib/material";
import { Array as Arr, Effect, Option, Random } from "effect";
import {
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  Suspense,
  useRef,
  useState,
} from "react";
import type { Group } from "three";

/** Both cars cruise at 20 m/s, 72 km/h, two seconds apart. */
const SPEED = 20;
const GAP = 2 * SPEED;

/** Both brake as hard as the lesson's car once they brake. */
const DECELERATION = 5;

/** A learner who has not braked three seconds after the lights has missed them. */
const GIVE_UP = 3;

/** The driver sits on the right, as in a right-hand-drive car, at eye height. */
const EYE = [-0.4, 1.22, 0.36] as const;

/**
 * A reaction test from the driver's seat. The learner drives at 72 km/h two
 * seconds behind another car; at a moment they cannot predict, its brake
 * lights come on, and they press Brake as fast as they can. The card measures
 * the time from the frame that showed the lights to the press, turns it into
 * the road covered before braking, d = v·t_r, and then both cars brake to a
 * stop, so a slow reaction ends visibly closer to the car in front.
 */
export function ReactionTimeLab({
  description,
  labels,
  title,
}: {
  readonly description: ReactNode;
  readonly labels: {
    readonly average: ReactNode;
    readonly best: ReactNode;
    readonly brake: string;
    readonly early: ReactNode;
    readonly lastTime: ReactNode;
    readonly reactionDistance: ReactNode;
    readonly start: string;
    readonly viewLabel: string;
  };
  readonly title: ReactNode;
}) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [trials, setTrials] = useState<readonly number[]>([]);
  const trial = useRef<Trial>({
    lightsAt: Option.none(),
    reaction: Option.none(),
    time: 0,
    wait: 0,
  });
  const keyed = useRef(false);
  const quantity = useQuantity();
  const summary = summarizeTrials(trials);
  const last = Arr.last(trials);

  /** Starts a trial with a wait the learner cannot guess. */
  const start = () => {
    trial.current = {
      lightsAt: Option.none(),
      reaction: Option.none(),
      time: 0,
      wait: waitFrom(Effect.runSync(Random.next)),
    };
    setPhase("driving");
  };

  /** Judges a brake press made at `at` on the page's clock. */
  const press = (at: number) => {
    if (phase !== "driving" || Option.isSome(trial.current.reaction)) {
      start();
      return;
    }
    const judged = judgePress(trial.current.lightsAt, at / 1000);
    if (judged._tag === "early") {
      setPhase("early");
      return;
    }
    trial.current = { ...trial.current, reaction: Option.some(judged.seconds) };
    setTrials((kept) => keepTrial(kept, judged.seconds));
  };

  const pressing = phase === "driving" && Option.isNone(trial.current.reaction);

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />

      <VisualCardBody
        aria-label={labels.viewLabel}
        className={threeSceneFrameVariants()}
        render={<section />}
      >
        <ScienceStage reach={40} setting="field">
          <Suspense fallback={null}>
            <ReactionScene
              onSettled={() => setPhase("done")}
              running={phase === "driving"}
              trial={trial}
            />
          </Suspense>
        </ScienceStage>
      </VisualCardBody>

      <VisualCardActions>
        <Button
          onClick={(event) => {
            // A screen reader or a key activates without a pointer.
            if (event.detail === 0 && !keyed.current) {
              press(event.timeStamp);
            }
            keyed.current = false;
          }}
          onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => {
            if ((event.key === " " || event.key === "Enter") && !event.repeat) {
              keyed.current = true;
              press(event.timeStamp);
            }
          }}
          onPointerDown={(event) => press(event.timeStamp)}
          variant="secondary"
        >
          {pressing ? labels.brake : labels.start}
        </Button>
        <VisualCardFullscreen />
      </VisualCardActions>

      <VisualCardFooter>
        <VisualCardFacts>
          <VisualFactTabular
            label={labels.lastTime}
            value={
              phase === "early"
                ? labels.early
                : Option.match(last, {
                    onNone: () => "–",
                    onSome: (seconds) => (
                      <InlineMath math={quantity(seconds, UNIT.time, 2)} />
                    ),
                  })
            }
          />
          <VisualFactTabular
            label={labels.reactionDistance}
            value={Option.match(last, {
              onNone: () => "–",
              onSome: (seconds) => (
                <InlineMath math={quantity(SPEED * seconds, UNIT.length)} />
              ),
            })}
          />
          <VisualFactTabular
            label={labels.best}
            value={Option.match(summary, {
              onNone: () => "–",
              onSome: ({ best }) => (
                <InlineMath math={quantity(best, UNIT.time, 2)} />
              ),
            })}
          />
          <VisualFactTabular
            label={labels.average}
            value={Option.match(summary, {
              onNone: () => "–",
              onSome: ({ mean }) => (
                <InlineMath math={quantity(mean, UNIT.time, 2)} />
              ),
            })}
          />
        </VisualCardFacts>
      </VisualCardFooter>
    </VisualCard>
  );
}

/** The stop of the car in front: it brakes when its lights come on. */
function leadOf(trial: Trial): Stop {
  return { deceleration: DECELERATION, reaction: trial.wait, speed: SPEED };
}

/**
 * The stop of the learner's car: it cruises until the learner brakes, or
 * gives up waiting for them three seconds after the lights.
 */
function egoOf(trial: Trial): Stop {
  return {
    deceleration: DECELERATION,
    reaction:
      trial.wait +
      Option.getOrElse(trial.reaction, () => Number.POSITIVE_INFINITY),
    speed: SPEED,
  };
}

/**
 * Moves a running trial on by one frame. The first frame past the wait shows
 * the brake lights, so the moment it is drawn is the moment the learner can
 * first see them; a learner still not braking three seconds later has missed
 * them.
 */
function advanceTrial(trial: Trial, delta: number): Trial {
  const time = trial.time + Math.min(delta, 0.1);
  const lightsAt =
    time >= trial.wait && Option.isNone(trial.lightsAt)
      ? Option.some(performance.now() / 1000)
      : trial.lightsAt;
  const reaction =
    Option.isNone(trial.reaction) && time > trial.wait + GIVE_UP
      ? Option.some(GIVE_UP)
      : trial.reaction;
  return { lightsAt, reaction, time, wait: trial.wait };
}

/**
 * The road seen from behind the wheel. The scene owns the trial clock: it
 * lights the brake lights once the wait is over and records the moment the
 * frame that shows them is drawn, which is when the learner can first see
 * them, then brakes both cars and reports when they stand still.
 */
function ReactionScene({
  onSettled,
  running,
  trial,
}: {
  readonly onSettled: () => void;
  readonly running: boolean;
  readonly trial: RefObject<Trial>;
}) {
  const lead = useRef<SedanRig>(null);
  const rig = useRef<Group>(null);
  const settled = useRef(false);

  useFrame((_, delta) => {
    const current = running
      ? advanceTrial(trial.current, delta)
      : trial.current;
    trial.current = current;
    const lights = current.time >= current.wait;
    const leadX =
      GAP + SEDAN.length + stopPosition(leadOf(current), current.time);
    lead.current?.place(leadX, running && lights);
    rig.current?.position.setX(stopPosition(egoOf(current), current.time));
    if (!running) {
      settled.current = false;
      return;
    }
    if (
      !settled.current &&
      Option.isSome(current.reaction) &&
      current.time > stoppingTime(egoOf(current)) + 0.4
    ) {
      settled.current = true;
      onSettled();
    }
  });

  return (
    <>
      <SimulationTicker running={running} />
      <Road from={-40} surface="dry" to={GAP + 400} />
      <group position={[0, 0, ROAD.lane]}>
        <Sedan color={MATERIAL.carPaintDark} ref={lead} />
        <group ref={rig}>
          <Cockpit />
        </group>
      </group>
    </>
  );
}

/**
 * What the driver sees of their own car: the bonnet ahead, the dashboard,
 * the steering wheel and the pillars of the windscreen, with the camera at
 * the driver's eyes.
 */
function Cockpit() {
  return (
    <group>
      <PerspectiveCamera
        fov={50}
        makeDefault
        position={EYE}
        rotation={[0, -Math.PI / 2, 0]}
      />
      <mesh position={[1.45, 0.92, 0]} rotation={[0, 0, -0.08]}>
        <boxGeometry args={[1.7, 0.06, SEDAN.width - 0.12]} />
        <meshPhysicalMaterial
          clearcoat={1}
          clearcoatRoughness={0.05}
          color={MATERIAL.carPaint}
          metalness={0.4}
          roughness={0.34}
        />
      </mesh>
      <mesh position={[0.42, 0.88, 0]}>
        <boxGeometry args={[0.5, 0.16, SEDAN.width - 0.2]} />
        <meshStandardMaterial color={MATERIAL.dashboard} roughness={0.85} />
      </mesh>
      <mesh
        position={[0.08, 0.86, EYE[2]]}
        rotation={[0, Math.PI / 2, -0.42, "ZYX"]}
      >
        <torusGeometry args={[0.19, 0.022, 12, 40]} />
        <meshStandardMaterial color={MATERIAL.tyre} roughness={0.6} />
      </mesh>
      {Arr.map([1, -1] as const, (side) => (
        <mesh
          key={side}
          position={[0.62, 1.2, side * 0.74]}
          rotation={[0, 0, -0.95]}
        >
          <boxGeometry args={[0.62, 0.07, 0.07]} />
          <meshStandardMaterial color={MATERIAL.dashboard} roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0.05, 1.47, 0]}>
        <boxGeometry args={[0.5, 0.05, SEDAN.width - 0.3]} />
        <meshStandardMaterial color={MATERIAL.headliner} roughness={0.9} />
      </mesh>
    </group>
  );
}
