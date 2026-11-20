import { useFrame } from "@react-three/fiber";
import { useRunClock } from "@repo/design-system/components/contents/biology/clock";
import {
  FRONT,
  MICRONS,
} from "@repo/design-system/components/contents/biology/muscle/bundle";
import {
  CAPILLARY,
  crowding,
  effort,
  flow,
  force,
  lactic,
  RELAXED,
  RUN,
  sarcomere,
  stageAt,
  uptake,
} from "@repo/design-system/components/contents/biology/muscle/debt";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { useRequired } from "@repo/design-system/hooks/required";
import { Schema } from "effect";
import type { ReactNode, RefObject } from "react";
import { createContext, useRef } from "react";

/** How many minutes of the run pass in a second while the card plays: the whole run in 20 s. */
const MINUTES_PER_SECOND = 0.8;

/** How many contractions the fibres make in a second of play while exercising, as a pedalling leg does. */
const BEAT = 1;

/**
 * How much slower than life the scene moves its blood: red cells cross a
 * capillary at a few hundred micrometres a second, which at this scale would
 * be a blur, so the scene plays them 25 times slower.
 */
const SLOWER = 25;

/** A number the provider rewrites every frame. */
const Live = Schema.mutableKey(Schema.Finite);

/**
 * Everything the scene draws at this frame, written once a frame by the
 * provider and read by every part: the minute of the run, how far into a
 * contraction the fibres are, the sarcomere length it gives, how much the
 * fibres shorten and swell, the lactic acid, how far the blood has run, and
 * how closely its red cells crowd against their closest after contractions,
 * and the oxygen taken up as a share of the most the lab can take up.
 * `carried` is in scene units, `sarcomere` in micrometres, `seconds` the
 * scene's own seconds of play; the rest are shares from 0 to 1 or ratios to
 * the relaxed fibre.
 */
const PoseSchema = Schema.Struct({
  carried: Live,
  crowd: Live,
  drive: Live,
  lactic: Live,
  minute: Live,
  oxygen: Live,
  peak: Live,
  sarcomere: Live,
  seconds: Live,
  share: Live,
  shift: Live,
  stretch: Live,
  swell: Live,
});
type Pose = typeof PoseSchema.Type;

const PoseContext = createContext<RefObject<Pose> | null>(null);

/** Reads the pose the surrounding provider writes each frame, as a ref to read inside a frame. */
export function usePose() {
  return useRequired(PoseContext, "usePose");
}

/**
 * Runs the clock of a working muscle and shares its pose with the scene. The
 * card plays the run from rest through exercise to recovery, minute 0 to 16,
 * and the provider turns each moment into what the scene draws. While the card
 * is still, the fibres hold the peak of a contraction during exercise, so a
 * paused frame shows them shortened.
 */
export function PoseProvider({
  children,
  elapsed,
  most,
  onElapsed,
  rest,
  work,
}: {
  readonly children: ReactNode;
  readonly elapsed: number;
  readonly most: number;
  readonly onElapsed: (minute: number) => void;
  readonly rest: number;
  readonly work: number;
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const clock = useRunClock({
    elapsed,
    onElapsed,
    perSecond: MINUTES_PER_SECOND,
    steps: 64,
    total: RUN.close,
  });
  const live = useRef<Pose>({
    carried: 0,
    crowd: 1,
    drive: 0,
    lactic: 0,
    minute: 0,
    oxygen: 0,
    peak: 0,
    sarcomere: RELAXED,
    seconds: 1 / (2 * BEAT),
    share: 0,
    shift: 0,
    stretch: 1,
    swell: 1,
  });

  useFrame((_, delta) => {
    const pose = live.current;
    const minute = clock.current;
    const step = playing ? simulationStep(delta) : 0;
    const exercising = stageAt(minute) === "exercise";
    pose.minute = minute;
    pose.seconds += step;
    pose.lactic = lactic(minute, work, most);
    pose.peak = lactic(RUN.end, work, most);
    pose.share = effort(minute, rest, work, most);
    pose.oxygen = uptake(minute, rest, work) / (rest + most);
    pose.crowd =
      crowding(minute, rest, work, most) /
      (CAPILLARY.work.flux / CAPILLARY.work.speed);
    pose.carried += (step * flow(minute, rest, work, most)) / SLOWER / MICRONS;
    pose.drive = exercising
      ? 0.5 - 0.5 * Math.cos(pose.seconds * BEAT * Math.PI * 2)
      : 0;
    pose.sarcomere = sarcomere(pose.drive, force(pose.lactic));
    pose.stretch = pose.sarcomere / RELAXED;
    pose.swell = 1 / Math.sqrt(pose.stretch);
    pose.shift = FRONT * (1 - pose.stretch);
  }, -1);

  return <PoseContext value={live}>{children}</PoseContext>;
}
