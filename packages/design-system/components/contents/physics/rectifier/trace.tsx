import type { RectifierMode } from "@repo/design-system/components/contents/physics/rectifier/model";
import { sampleRectifierWave } from "@repo/design-system/components/contents/physics/rectifier/model";
import { QUANTUM_COLORS } from "@repo/design-system/lib/material/quantum";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useMemo } from "react";

const WIDTH = 200;
const HEIGHT = 84;
const MID = HEIGHT / 2;

const xOf = (phase: number) => (phase / (Math.PI * 4)) * WIDTH;
const yOf = (val: number) => MID - val * (MID - 8);

export function RectifierTrace({
  inputLabel,
  mode,
  outputLabel,
}: {
  readonly inputLabel: ReactNode;
  readonly mode: RectifierMode;
  readonly outputLabel: ReactNode;
}) {
  const samples = useMemo(() => sampleRectifierWave(mode, 64), [mode]);

  const inputPoints = useMemo(
    () =>
      Arr.join(
        Arr.map(samples, (pt) => `${xOf(pt.phase)},${yOf(pt.input)}`),
        " "
      ),
    [samples]
  );
  const outputPoints = useMemo(
    () =>
      Arr.join(
        Arr.map(samples, (pt) => `${xOf(pt.phase)},${yOf(pt.output)}`),
        " "
      ),
    [samples]
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="text-muted-foreground flex flex-wrap justify-between gap-x-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ backgroundColor: QUANTUM_COLORS.acWave }}
          />
          {inputLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ backgroundColor: QUANTUM_COLORS.dcWave }}
          />
          {outputLabel}
        </span>
      </div>
      <div className="relative h-24 px-1 pb-1">
        <div className="border-border relative h-full border-s border-b">
          <svg
            aria-hidden="true"
            className="absolute inset-0 size-full overflow-visible"
            preserveAspectRatio="none"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          >
            <line
              className="stroke-border"
              strokeDasharray="3 3"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              x1={0}
              x2={WIDTH}
              y1={MID}
              y2={MID}
            />
            <polyline
              fill="none"
              points={inputPoints}
              stroke={QUANTUM_COLORS.acWave}
              strokeOpacity={0.55}
              strokeWidth={1.6}
              vectorEffect="non-scaling-stroke"
            />
            <polyline
              fill="none"
              points={outputPoints}
              stroke={QUANTUM_COLORS.dcWave}
              strokeLinejoin="round"
              strokeWidth={2.4}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
