import { Line } from "@react-three/drei";
import {
  BOARD,
  INK,
  LABEL_SIZE,
  PAPER_LABEL,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/board";
import type { Axes } from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/diagram";
import {
  isothermSpots,
  SAMPLES,
  spreadApart,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/diagram";
import type {
  GasProcess,
  GasState,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/gas";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { ThreeLabel } from "@repo/design-system/components/three/label";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Option } from "effect";
import { Vector3 } from "three";

/** How far apart two isotherms' names stand at least, and how low the lower may stand, in metres. */
const NAMES = { floor: 0.022, gap: 0.032 } as const;

/**
 * The isotherms through the start and the end, dashed, each named by its
 * temperature just right of the plot, the two names kept apart: the gas
 * ends hotter when its end lies on the higher one. An isothermal process
 * keeps to one, through both ends.
 */
export function Isotherms({
  axes,
  end,
  process,
  start,
}: {
  readonly axes: Axes;
  readonly end: GasState;
  readonly process: GasProcess;
  readonly start: GasState;
}) {
  const plot = BOARD.plot;
  const lines = Arr.getSomes(
    Arr.map(
      process === "isothermal"
        ? [{ math: "T_1 = T_2", state: start }]
        : [
            { math: "T_1", state: start },
            { math: "T_2", state: end },
          ],
      (line) => {
        const spots = isothermSpots(line.state, axes, plot, SAMPLES);
        return Option.map(Arr.last(spots), (tail) => ({
          ...line,
          spots,
          tail: tail.y,
        }));
      }
    )
  );
  const [one, two] = lines;
  const heights =
    one !== undefined && two !== undefined
      ? spreadApart([one.tail, two.tail], NAMES.gap, NAMES.floor)
      : Arr.map(lines, (line) => Math.max(NAMES.floor, line.tail));

  return (
    <group>
      {Arr.map(lines, (line, index) => (
        <group key={line.math}>
          <Line
            color={PLOT_COLORS.slate}
            dashed
            dashSize={0.008}
            gapSize={0.006}
            lineWidth={1.5}
            points={Arr.map(
              line.spots,
              (spot) => new Vector3(spot.x, spot.y, INK)
            )}
          />
          <ThreeLabel
            {...PAPER_LABEL}
            anchorX="left"
            color={PLOT_COLORS.slate}
            fontSize={LABEL_SIZE}
            gap={0.006}
            position={[plot.width, heights[index] ?? NAMES.floor, INK]}
          >
            <InlineMath math={line.math} />
          </ThreeLabel>
        </group>
      ))}
    </group>
  );
}
