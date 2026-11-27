import { useFrame, useThree } from "@react-three/fiber";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import type { GasMoment } from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/cylinder";
import {
  momentAt,
  PLAY_SECONDS,
  playShare,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/cylinder";
import { SAMPLES } from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/diagram";
import type {
  GasProcess,
  GasState,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/gas";
import { GasRig } from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/rig";
import { SimulationTicker } from "@repo/design-system/components/contents/simulation/ticker";
import { useTimeline } from "@repo/design-system/components/contents/simulation/timeline";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { isNarrowThreeScene } from "@repo/design-system/components/three/scene";
import type { RefObject } from "react";
import { useRef } from "react";

/**
 * How large the apparatus stands and how long an energy arrow grows, in
 * metres. A narrow card stands a little farther back, so the cylinder, its
 * gauge and its thermometer all stay in the square.
 */
const PLACES = {
  narrow: { arrow: 0.1, size: 1 },
  wide: { arrow: 0.12, size: 1 },
} as const;

/** Where the camera looks and how far back it stands. */
const VIEW = {
  narrow: { distance: 1, target: [0.01, 0.245, 0] },
  wide: { distance: 0.88, target: [0.01, 0.235, 0] },
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
 * The gas process lab on a chemistry bench, and nothing else in the scene:
 * the cylinder of gas on its stand with its piston, its pressure gauge and
 * its thermometer, and round it what holds the process. Its p-V diagram
 * stands under the scene, in the footer of the card.
 */
export function GasProcessScene({
  end,
  fullPressure,
  gamma,
  kelvin,
  largest,
  onShare,
  process,
  scale,
  span,
  start,
}: {
  readonly end: GasState;
  /** The pressure the gauge reads at the end of its dial. */
  readonly fullPressure: number;
  readonly gamma: number;
  readonly kelvin: (temperature: number) => string;
  /** The volume the tallest column of gas holds. */
  readonly largest: number;
  readonly onShare: (share: number) => void;
  readonly process: GasProcess;
  readonly scale: number;
  readonly span: { readonly high: number; readonly low: number };
  readonly start: GasState;
}) {
  const now = useRef<GasMoment>(
    momentAt(process, { end, start }, gamma, { playing: false, share: 1 })
  );
  const narrow = isNarrowThreeScene(
    useThree((state) => state.size),
    1.2
  );
  const places = narrow ? PLACES.narrow : PLACES.wide;
  const told = useRef(1);
  // The diagram under the scene follows the gas in the steps its path is drawn in, not in every frame.
  // The clock is a child, so its frame has already written the moment this one reads.
  useFrame(() => {
    const step = Math.round(now.current.share * SAMPLES) / SAMPLES;
    if (step !== told.current) {
      told.current = step;
      onShare(step);
    }
  });
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
      <group scale={places.size}>
        <GasRig
          fullPressure={fullPressure}
          heatShown={Math.abs(final.heat) > scale * 1e-9}
          kelvin={kelvin}
          largest={largest}
          longest={places.arrow}
          now={now}
          process={process}
          scale={scale}
          span={{ ...span, start: start.temperature }}
          startVolume={start.volume}
          workShown={Math.abs(final.work) > scale * 1e-9}
        />
      </group>
    </group>
  );
}

/** Looks at the apparatus from the front, a little above the bench; farther back on a narrow card. */
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
