import { useFrame, useThree } from "@react-three/fiber";
import { Die } from "@repo/design-system/components/contents/mathematics/dice/die";
import type { DiceCount } from "@repo/design-system/components/contents/mathematics/dice/odds";
import { outcomes } from "@repo/design-system/components/contents/mathematics/dice/odds";
import type { Roll } from "@repo/design-system/components/contents/mathematics/dice/roll";
import {
  posesAt,
  ROLLS,
  runSeconds,
  settledBy,
  tally,
} from "@repo/design-system/components/contents/mathematics/dice/roll";
import { rackWidth } from "@repo/design-system/components/contents/mathematics/dice/stack";
import type { ChipsHandle } from "@repo/design-system/components/contents/mathematics/dice/table";
import {
  Chips,
  Rack,
  Tray,
} from "@repo/design-system/components/contents/mathematics/dice/table";
import { StudioTable } from "@repo/design-system/components/contents/mathematics/table";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { useTimeline } from "@repo/design-system/components/contents/simulation/timeline";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { TABLE_COLORS } from "@repo/design-system/lib/material/table";
import { Array as Arr, Option } from "effect";
import { useRef } from "react";
import type { Group } from "three";

/** The finish of each die of a pair: an ivory die and an onyx one, so the two read apart. */
const FINISHES = ["ivory", "onyx"] as const;

/** The least time between two updates of the readouts while the run plays, in seconds. */
const REPORT_SECONDS = 0.12;

/**
 * The dice tray and the chip tally behind it, run by the card's play clock.
 * Every frame places the dice from the run's pure timeline; a roll that comes
 * to rest restacks the chips and, a few times a second at most, tells the
 * card how many rolls have settled, so its readouts follow without the scene
 * re-rendering. With no `target`, no stack is highlighted.
 */
export function DiceScene({
  dice,
  highlight,
  onSettled,
  rolls,
  target,
}: {
  readonly dice: DiceCount;
  readonly highlight: string;
  readonly onSettled: (count: number) => void;
  readonly rolls: readonly Roll[];
  readonly target: number | undefined;
}) {
  const shown = outcomes(dice);
  const targetStack = Option.getOrElse(
    Arr.findFirstIndex(shown, (outcome) => outcome === target),
    () => -1
  );
  const { advance, playing } = useTimeline(0, runSeconds(rolls));
  const first = useRef<Group>(null);
  const second = useRef<Group>(null);
  const chips = useRef<ChipsHandle>(null);
  const stacked = useRef(-1);
  const reported = useRef({ at: Number.NEGATIVE_INFINITY, count: ROLLS });

  useFrame((state, delta) => {
    const time = advance(delta);
    Arr.forEach(posesAt(rolls, time), (pose, die) => {
      const body = die === 0 ? first.current : second.current;
      body?.position.set(...pose.position);
      body?.quaternion.set(...pose.turn);
    });
    const settled = settledBy(rolls, time);
    if (settled !== stacked.current) {
      stacked.current = settled;
      chips.current?.restack(tally(rolls, settled, dice), targetStack);
    }
    const now = state.clock.elapsedTime;
    const last = reported.current;
    if (
      settled !== last.count &&
      (now - last.at >= REPORT_SECONDS || settled === ROLLS || !playing)
    ) {
      reported.current = { at: now, count: settled };
      onSettled(settled);
    }
  });

  return (
    <>
      <SimulationTicker running={playing} />
      <DiceCamera span={rackWidth(shown.length)} />
      <StudioTable color={TABLE_COLORS.maple} />
      <Tray />
      <Rack highlight={highlight} outcomes={shown} target={target} />
      <Chips capacity={ROLLS} highlight={highlight} ref={chips} />
      {Arr.map(Arr.take(FINISHES, dice), (finish, die) => (
        <Die finish={finish} key={finish} ref={die === 0 ? first : second} />
      ))}
    </>
  );
}

/** The camera's vertical field of view, in degrees. */
const FIELD = 34;

/**
 * How far the camera may swing round either side of the front, in radians,
 * by the learner's hand or while the run plays: about 34 degrees, so the
 * stacks always read as a histogram and their numbers never cross.
 */
const TURN_LIMIT = 0.6;

/** How tall a view the camera keeps, from the table to above the tallest stack, in metres. */
const VIEW_HEIGHT = 0.32;

/**
 * Looks over the front of the tray at the stacks behind it, from just far
 * enough back that the whole rack, `span` metres wide, and the tallest stack
 * fit the card at its shape.
 */
function DiceCamera({ span }: { readonly span: number }) {
  const size = useThree((state) => state.size);
  const lens = 2 * Math.tan(((FIELD / 2) * Math.PI) / 180);
  const distance = Math.max(
    VIEW_HEIGHT / lens,
    (span + 0.04) / (lens * (size.width / size.height))
  );
  return (
    <CameraControls
      cameraPosition={[0.04, 0.06 + distance * 0.52, 0.02 + distance * 0.86]}
      cameraTarget={[0, 0.06, -0.035]}
      fov={FIELD}
      maxAzimuthAngle={TURN_LIMIT}
      maxDistance={distance * 2}
      maxPolarAngle={1.35}
      minAzimuthAngle={-TURN_LIMIT}
      minDistance={0.14}
    />
  );
}
