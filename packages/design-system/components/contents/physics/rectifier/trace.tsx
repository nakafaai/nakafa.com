import type { RectifierMode } from "@repo/design-system/components/contents/physics/rectifier/model";
import { sampleRectifierWave } from "@repo/design-system/components/contents/physics/rectifier/model";
import { TraceChart } from "@repo/design-system/components/contents/simulation/trace";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useMemo } from "react";

/** How many points each wave is drawn through over its two periods. */
const STEPS = 128;
/** The phase the plot covers, in half turns, so its axis marks every half period. */
const HALF_TURNS = 4;

/** The alternating input of the rectifier and the output its diodes leave of it, over two periods. */
export function RectifierTrace({
  inputLabel,
  mode,
  outputLabel,
}: {
  readonly inputLabel: ReactNode;
  readonly mode: RectifierMode;
  readonly outputLabel: ReactNode;
}) {
  const data = useMemo(
    () =>
      Arr.map(sampleRectifierWave(mode, STEPS), (point) => ({
        input: point.input,
        output: point.output,
        turns: point.phase / Math.PI,
      })),
    [mode]
  );

  return (
    <TraceChart
      data={data}
      series={[
        {
          color: QUANTUM_COLORS.acWave,
          curve: "linear",
          dashed: true,
          key: "input",
          label: inputLabel,
          width: 1.75,
        },
        {
          color: QUANTUM_COLORS.dcWave,
          curve: "linear",
          key: "output",
          label: outputLabel,
        },
      ]}
      x={{
        domain: [0, HALF_TURNS],
        key: "turns",
        ticks: Arr.range(0, HALF_TURNS),
      }}
      y={{ domain: [-1.2, 1.2], ticks: [-1, 0, 1] }}
    />
  );
}
