import { useFrame, useThree } from "@react-three/fiber";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { useRunClock } from "@repo/design-system/components/contents/biology/clock";
import {
  BEAKER,
  Beaker,
} from "@repo/design-system/components/contents/biology/respirometer/beaker";
import { thermometerShare } from "@repo/design-system/components/contents/biology/respirometer/gas";
import { BoilingTube } from "@repo/design-system/components/contents/biology/respirometer/glass";
import {
  BossArm,
  RetortStand,
  STAND,
  TubeJaws,
  tubeStop,
} from "@repo/design-system/components/contents/biology/respirometer/stand";
import { Thermometer } from "@repo/design-system/components/contents/biology/respirometer/thermometer";
import { Limewater } from "@repo/design-system/components/contents/biology/yeast/cloud";
import {
  plugDepth,
  SETUP,
} from "@repo/design-system/components/contents/biology/yeast/ferment";
import {
  ControlFill,
  YeastFill,
} from "@repo/design-system/components/contents/biology/yeast/fill";
import {
  Bung,
  DeliveryTube,
  HOLE_OFFSET,
  TestTube,
} from "@repo/design-system/components/contents/biology/yeast/glass";
import { OUTLET } from "@repo/design-system/components/contents/biology/yeast/limewater";
import {
  RACK_FLOOR,
  RACK_FRONT,
  RACK_TOP,
  Rack,
} from "@repo/design-system/components/contents/biology/yeast/rack";
import {
  RunContext,
  useRun,
} from "@repo/design-system/components/contents/biology/yeast/run";
import {
  BOILING_TUBE,
  levelOf,
  TEST_TUBE,
} from "@repo/design-system/components/contents/biology/yeast/tube";
import { riseAt } from "@repo/design-system/components/contents/biology/yeast/warmth";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import { simulationStep } from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";

/** How many minutes the run lasts: an hour, as a school lesson allows. */
export const RUN_MINUTES = 60;

/** How many minutes of the run pass in a second of play: the hour in 30 s, 120 times real time. */
const MINUTES_PER_SECOND = 2;

/** How high the beaker's foot stands, in metres: on the base of the retort stand, as in the respirometer lab. */
const FLOOR = STAND.base.thickness;

/** Where each boiling tube stands from the bath's middle, and the foot of each, 3 cm clear of the beaker's floor, in metres. */
const TUBE_X = 0.024;
const TUBE_FOOT = FLOOR + BEAKER.wall + 0.03;

/** How far out each limewater tube stands, and how high the delivery tubes run across, in metres. */
const LIME_X = 0.118;
const RUN_HEIGHT = 0.216;

/** Where the one retort stand that holds both tubes has its rod: behind the bath, as in the respirometer lab, in metres. */
const ROD = { x: 0, z: -0.105 } as const;

/**
 * How high each tube's clamp grips it, in metres, one above the other on
 * the one rod: both above the beaker's rim, the lower arm passing 2 mm over it.
 */
const GRIP = { control: 0.1815, yeast: 0.1545 } as const;

/**
 * How far the bench runs to the left of the bath, in metres: the bench's
 * reagent bottles then stand back and to the left, out of the experiment's
 * way.
 */
const RIG_X = 0.4;

/** The two sets: the yeast on the left and the control on the right. */
const SIDES = { control: 1, yeast: -1 } as const;

/** Where the two boiling tubes stand in the bath, so its water parts round them. */
const WELLS = [SIDES.yeast * TUBE_X, SIDES.control * TUBE_X] as const;

/**
 * The fermentation experiment and its control in one water bath on the
 * bench, run on the card's clock: an hour passes in 30 s of play while every
 * bubble keeps its real pace. The glassware, the bath, the stand and the
 * thermometers are the respirometer lab's, so both experiments of the
 * lesson stand in one laboratory.
 */
export function YeastScene({
  celsius,
  elapsed,
  onElapsed,
  percent,
  words,
}: {
  readonly celsius: number;
  readonly elapsed: number;
  readonly onElapsed: (minutes: number) => void;
  readonly percent: number;
  readonly words: {
    readonly bath: string;
    readonly control: string;
    readonly limewater: string;
    readonly paraffin: string;
    readonly thermometer: string;
    readonly yeast: string;
  };
}) {
  const clock = useRunClock({
    elapsed,
    onElapsed,
    perSecond: MINUTES_PER_SECOND,
    steps: 120,
    total: RUN_MINUTES,
  });
  const playing = useVisualScene((card) => card.playing, false);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    if (playing) {
      invalidate();
    }
  }, [invalidate, playing]);
  const seconds = useRef(17.3);
  useFrame((_, delta) => {
    if (playing) {
      seconds.current += simulationStep(delta);
    }
  });
  const run = useMemo(
    () => ({ celsius, clock, elapsed, percent, seconds, words }),
    [celsius, clock, elapsed, percent, words]
  );

  return (
    <RunContext value={run}>
      <YeastCamera />
      <group position={[-RIG_X, 0, 0]}>
        <LabBench />
      </group>
      <group position={[ROD.x, 0, ROD.z]}>
        <RetortStand />
        <Clamp kind="yeast" />
        <Clamp kind="control" />
      </group>
      <group position={[0, FLOOR, 0]}>
        <Beaker wells={WELLS} />
      </group>
      <Rig kind="yeast" />
      <Rig kind="control" />
      <Labels />
    </RunContext>
  );
}

/** The boss head and clamp on the stand's rod that hold one set's boiling tube. */
function Clamp({ kind }: { readonly kind: keyof typeof SIDES }) {
  const grip = BOILING_TUBE.diameter / 2;
  return (
    <BossArm
      height={GRIP[kind]}
      stop={tubeStop(grip)}
      target={[SIDES[kind] * TUBE_X - ROD.x, -ROD.z]}
    >
      <TubeJaws grip={grip} />
    </BossArm>
  );
}

/**
 * The corners each delivery tube is bent through: up from below the bung, out
 * over the bath's rim, and down into its limewater, ending 1 cm above the
 * test tube's foot. It runs about 34 cm, as the delivery tube's dead volume
 * counts it.
 */
function deliveryPath(side: number) {
  const hole = side * (TUBE_X + HOLE_OFFSET);
  return [
    [hole, TUBE_FOOT + BOILING_TUBE.length - plugDepth() - 0.004, 0],
    [hole, RUN_HEIGHT, 0],
    [side * LIME_X, RUN_HEIGHT, 0],
    [side * LIME_X, RACK_FLOOR + TEST_TUBE.wall + OUTLET, 0],
  ] as const;
}

/** Both delivery tubes' corners, worked out once. */
const DELIVERY_PATHS = {
  control: deliveryPath(SIDES.control),
  yeast: deliveryPath(SIDES.yeast),
} as const;

/**
 * One set of the experiment: a boiling tube in the bath, its bung,
 * thermometer and delivery tube, and the limewater it bubbles into.
 */
function Rig({ kind }: { readonly kind: keyof typeof SIDES }) {
  const run = useRun();
  const side = SIDES[kind];
  const warmth =
    kind === "yeast" ? riseAt(run.celsius, run.percent, run.elapsed) : 0;

  return (
    <group>
      <group position={[side * TUBE_X, TUBE_FOOT, 0]}>
        {kind === "yeast" ? <YeastFill /> : <ControlFill />}
        <BoilingTube />
        <group position={[0, BOILING_TUBE.length - plugDepth(), 0]}>
          <Bung />
        </group>
        <group position={[-side * HOLE_OFFSET, BOILING_TUBE.wall + 0.004, 0]}>
          <Thermometer share={thermometerShare(run.celsius + warmth)} />
        </group>
      </group>
      <DeliveryTube points={DELIVERY_PATHS[kind]} />
      <group position={[side * LIME_X, 0, 0]}>
        <Rack />
        <group position={[0, RACK_FLOOR, 0]}>
          <Limewater fed={kind === "yeast"} />
          <TestTube />
        </group>
      </group>
    </group>
  );
}

/** One word of the scene, written beside the part it names. */
function Word({
  anchor,
  children,
  position,
}: {
  readonly anchor: "center" | "left" | "right";
  readonly children: ReactNode;
  readonly position: readonly [number, number, number];
}) {
  const ink = useLabelInk();
  return (
    <ThreeLabel
      anchorX={anchor}
      color={ink}
      fontSize="compact"
      position={position}
    >
      {children}
    </ThreeLabel>
  );
}

/** The names of both tubes and of the parts a learner reads the experiment by. */
function Labels() {
  const { words } = useRun();
  const oil =
    TUBE_FOOT + BOILING_TUBE.wall + levelOf(BOILING_TUBE, SETUP.glucose);
  const set = (TUBE_X + LIME_X) / 2;
  return (
    <group>
      <Word anchor="center" position={[-set, RUN_HEIGHT - 0.016, 0]}>
        {words.yeast}
      </Word>
      <Word anchor="center" position={[set, RUN_HEIGHT - 0.016, 0]}>
        {words.control}
      </Word>
      <Word anchor="left" position={[TUBE_X + 0.017, oil, 0]}>
        {words.paraffin}
      </Word>
      <Word anchor="center" position={[-LIME_X, RACK_TOP + 0.012, RACK_FRONT]}>
        {words.limewater}
      </Word>
      <Word anchor="center" position={[0, FLOOR + 0.02, BEAKER.radius + 0.006]}>
        {words.bath}
      </Word>
      <Word anchor="left" position={[TUBE_X - HOLE_OFFSET + 0.006, 0.285, 0]}>
        {words.thermometer}
      </Word>
    </group>
  );
}

/** Looks at the bath from the front and a little above, farther back on a narrow card. */
function YeastCamera() {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = narrow ? 0.62 : 0.54;
  return (
    <CameraControls
      cameraPosition={[0.03, 0.15 + distance * 0.28, distance * 0.96]}
      cameraTarget={[0, 0.15, 0]}
      fov={36}
      maxDistance={distance * 1.8}
      minDistance={0.12}
    />
  );
}
