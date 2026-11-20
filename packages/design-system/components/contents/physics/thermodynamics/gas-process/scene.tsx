import { useFrame, useThree } from "@react-three/fiber";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import {
  BOARD,
  PaperBoard,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/board";
import type { GasMoment } from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/cylinder";
import {
  momentAt,
  PLAY_SECONDS,
  playShare,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/cylinder";
import type { Axes } from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/diagram";
import { endAt } from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/diagram";
import type {
  EndRange,
  GasProcess,
  GasState,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/gas";
import { PlotMarks } from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/plot";
import { GasRig } from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/rig";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { useTimeline } from "@repo/design-system/components/contents/simulation/timeline";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import type { ReactNode, RefObject } from "react";
import { useCallback, useRef } from "react";

/**
 * Where the cylinder stands on the bench and at what size, where the
 * board's plot has its origin, and how long an energy arrow grows, in
 * metres. A wide card sets them side by side; a narrow one raises the board
 * on taller legs behind the cylinder's shoulder and sets a smaller cylinder
 * before it, so the two stack across the square and the diagram stays
 * large.
 */
const PLACES = {
  narrow: {
    arrow: 0.1,
    board: [-0.072, 0.315, -0.1],
    rig: [-0.17, 0, 0.06],
    size: 0.8,
  },
  wide: {
    arrow: 0.14,
    board: [0.0, 0.14, -0.05],
    rig: [-0.24, 0, 0.02],
    size: 1,
  },
} as const;

/** Where the camera looks and how far back it stands. */
const VIEW = {
  narrow: { distance: 1.12, target: [0.0, 0.3, 0] },
  wide: { distance: 0.9, target: [0.0, 0.22, 0] },
} as const;

/** How steeply the camera looks down on the bench, in radians. */
const ELEVATION = 0.2;

/**
 * Moves the gas along its process while the card plays, from state 1 to
 * state 2 over a few seconds, then rests on state 2 and starts again; still,
 * the gas stands at state 2. Every part of the scene reads the moment it
 * writes to `now`, so this runs first.
 */
function ProcessClock({
  end,
  gamma,
  now,
  process,
  start,
}: {
  readonly end: GasState;
  readonly gamma: number;
  readonly now: RefObject<GasMoment>;
  readonly process: GasProcess;
  readonly start: GasState;
}) {
  const { advance, playing } = useTimeline(0, PLAY_SECONDS);

  useFrame((_, delta) => {
    now.current = momentAt(process, { end, start }, gamma, {
      playing,
      share: playShare(advance(delta)),
    });
  });

  return <SimulationTicker running={playing} />;
}

/**
 * The gas process lab on a chemistry bench: the cylinder of gas on its
 * stand on the left, and on the right the board with its p-V diagram, on
 * which the learner presses or drags to set where the process ends.
 */
export function GasProcessScene({
  axes,
  end,
  gamma,
  kelvin,
  names,
  onEnd,
  process,
  range,
  scale,
  span,
  start,
  tick,
}: {
  readonly axes: Axes;
  readonly end: GasState;
  readonly gamma: number;
  readonly kelvin: (temperature: number) => string;
  readonly names: { readonly pressure: ReactNode; readonly volume: ReactNode };
  readonly onEnd: (value: number) => void;
  readonly process: GasProcess;
  readonly range: EndRange;
  readonly scale: number;
  readonly span: { readonly high: number; readonly low: number };
  readonly start: GasState;
  readonly tick: (value: number) => string;
}) {
  const now = useRef<GasMoment>(
    momentAt(process, { end, start }, gamma, { playing: false, share: 1 })
  );
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  const places = narrow ? PLACES.narrow : PLACES.wide;
  const onSpot = useCallback(
    (spot: { readonly x: number; readonly y: number }) =>
      onEnd(endAt(process, range, axes, BOARD.plot, spot)),
    [axes, onEnd, process, range]
  );
  const final = momentAt(process, { end, start }, gamma, {
    playing: false,
    share: 1,
  }).energy;

  return (
    <group>
      <ProcessClock
        end={end}
        gamma={gamma}
        now={now}
        process={process}
        start={start}
      />
      <GasCamera narrow={narrow} />
      <group position={[-0.7, 0, 0]}>
        <LabBench width={2.6} />
      </group>
      <group position={places.rig} scale={places.size}>
        <GasRig
          heatShown={Math.abs(final.heat) > scale * 1e-9}
          kelvin={kelvin}
          largest={axes.volume.maximum}
          longest={places.arrow}
          now={now}
          process={process}
          scale={scale}
          span={{ ...span, start: start.temperature }}
          startVolume={start.volume}
          workShown={Math.abs(final.work) > scale * 1e-9}
        />
      </group>
      <group position={places.board}>
        <PaperBoard
          axes={axes}
          names={names}
          rise={places.board[1]}
          tick={tick}
        />
        <PlotMarks
          axes={axes}
          end={end}
          gamma={gamma}
          now={now}
          onSpot={onSpot}
          process={process}
          start={start}
        />
      </group>
    </group>
  );
}

/** Looks at the cylinder and the board from the front, a little above the bench; farther back on a narrow card. */
function GasCamera({ narrow }: { readonly narrow: boolean }) {
  const { distance, target } = narrow ? VIEW.narrow : VIEW.wide;
  return (
    <CameraControls
      cameraPosition={[
        target[0],
        target[1] + distance * Math.sin(ELEVATION),
        target[2] + distance * Math.cos(ELEVATION),
      ]}
      cameraTarget={target}
      fov={36}
      maxAzimuthAngle={0.7}
      maxDistance={distance * 1.6}
      maxPolarAngle={Math.PI / 2 - 0.08}
      minAzimuthAngle={-0.7}
      minDistance={0.35}
    />
  );
}
