import { useFrame, useThree } from "@react-three/fiber";
import { RunClockContext } from "@repo/design-system/components/contents/biology/blood/clock";
import {
  FINISH,
  LOOP,
} from "@repo/design-system/components/contents/biology/blood/run";
import type {
  Sample,
  Serum,
} from "@repo/design-system/components/contents/biology/blood/serology";
import { SERA } from "@repo/design-system/components/contents/biology/blood/serology";
import { Stirrer } from "@repo/design-system/components/contents/biology/blood/stirrer";
import { Tile } from "@repo/design-system/components/contents/biology/blood/tile";
import { BloodTube } from "@repo/design-system/components/contents/biology/blood/tube";
import { Vial } from "@repo/design-system/components/contents/biology/blood/vial";
import {
  columnX,
  rowOf,
  rowZ,
  TILE,
} from "@repo/design-system/components/contents/biology/blood/well";
import { useLabelInk } from "@repo/design-system/components/contents/biology/cell/parts";
import { LabBench } from "@repo/design-system/components/contents/chemistry/bench";
import {
  SimulationTicker,
  simulationStep,
} from "@repo/design-system/components/contents/simulation/ticker";
import { CameraControls } from "@repo/design-system/components/three/camera/controls";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { useVisualScene } from "@repo/design-system/components/visual/card";
import { BIOLOGY_COLORS } from "@repo/design-system/lib/material/biology";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useRef } from "react";

/** The world size of the names written on the tile, in metres: about a marker's handwriting. */
const LABEL_SIZE = 0.0055;

/** How often the clock tells the card the time, in seconds of the run, so its readouts follow at a few updates a second. */
const REPORT = 0.25;

/**
 * The blood typing bench: the grouping tile with one row of cavities per
 * sample, the three antisera behind their columns, the tube of the sample
 * under test with its pipette, and the mixing sticks. Standing still, it
 * shows every test finished; playing, it runs the test of the chosen sample
 * from an empty row: serum, blood, stirring, and a minute of agglutination.
 * What the caller composes as `children`, such as the names written on the
 * tile, stands on the tile.
 */
export function BloodScene({
  children,
  chosen,
  onTime,
  samples,
}: {
  readonly children: ReactNode;
  readonly chosen: number;
  readonly onTime: (time: number) => void;
  readonly samples: readonly Sample[];
}) {
  const playing = useVisualScene((card) => card.playing, false);
  const view = useVisualScene((card) => card.view, 0);
  const clock = useRef(FINISH);
  const seen = useRef({ chosen, playing: false, sent: FINISH, view });

  useFrame((_, delta) => {
    const last = seen.current;
    if (last.view !== view) {
      last.view = view;
      last.chosen = chosen;
      clock.current = FINISH;
      last.sent = FINISH;
    }
    if (last.chosen !== chosen) {
      last.chosen = chosen;
      clock.current = playing ? 0 : FINISH;
    }
    if (playing && !last.playing && clock.current >= FINISH) {
      clock.current = 0;
    }
    last.playing = playing;
    if (playing) {
      const next = clock.current + simulationStep(delta);
      clock.current = next >= LOOP ? 0 : next;
    }
    const shown = Math.min(FINISH, Math.floor(clock.current / REPORT) * REPORT);
    if (shown !== last.sent) {
      last.sent = shown;
      onTime(clock.current >= FINISH ? FINISH : shown);
    }
  });

  return (
    <RunClockContext value={clock}>
      <SimulationTicker running={playing} />
      <BloodCamera />
      <LabBench />
      <group position={[-0.01, 0, 0.04]}>
        <Tile chosen={chosen} samples={samples} />
        {Arr.map(SERA, (serum, column) => (
          <Vial
            column={column}
            key={serum}
            row={rowOf(chosen, samples.length)}
            serum={serum}
          />
        ))}
        <BloodTube row={rowOf(chosen, samples.length)} />
        {Arr.map(SERA, (serum, column) => (
          <Stirrer
            column={column}
            key={serum}
            row={rowOf(chosen, samples.length)}
          />
        ))}
        {children}
      </group>
    </RunClockContext>
  );
}

/**
 * The names written on the tile, which the scene places on the tile as its
 * children: each serum under its column at the tile's front edge, and each
 * sample beside its row, the one under test in colour.
 */
export function TileLabels({
  chosen,
  names,
  sera,
}: {
  readonly chosen: number;
  readonly names: readonly string[];
  readonly sera: Readonly<Record<Serum, ReactNode>>;
}) {
  const ink = useLabelInk();
  return (
    <group>
      {Arr.map(SERA, (serum, column) => (
        <ThreeLabel
          anchorY="top"
          color={ink}
          fontSize={LABEL_SIZE}
          gap={0.003}
          key={serum}
          maximumFontSize={16}
          position={[columnX(column), TILE.height, TILE.length / 2 + 0.004]}
        >
          {sera[serum]}
        </ThreeLabel>
      ))}
      {Arr.map(names, (name, row) => (
        <ThreeLabel
          anchorX="right"
          color={row === chosen ? BIOLOGY_COLORS.auxin : ink}
          fontSize={LABEL_SIZE}
          gap={0.003}
          key={name}
          maximumFontSize={16}
          position={[
            -TILE.width / 2 - 0.004,
            TILE.height,
            rowZ(rowOf(row, names.length)),
          ]}
        >
          {name}
        </ThreeLabel>
      ))}
    </group>
  );
}

/** Looks down on the tile from the front, as a technician bends over it, farther back on a narrow card. */
function BloodCamera() {
  const size = useThree((state) => state.size);
  const narrow = size.width < size.height * 1.2;
  const distance = narrow ? 0.32 : 0.33;
  return (
    <CameraControls
      cameraPosition={[0.008, 0.012 + distance * 0.88, 0.05 + distance * 0.47]}
      cameraTarget={[0.012, 0.012, 0.024]}
      fov={36}
      maxDistance={distance * 1.8}
      minDistance={0.1}
    />
  );
}
