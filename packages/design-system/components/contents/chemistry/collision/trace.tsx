import { sampleBoltzmann } from "@repo/design-system/components/contents/chemistry/collision/model";
import { KINETICS_COLORS } from "@repo/design-system/lib/material/kinetics";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";
import { useMemo } from "react";

const WIDTH = 200;
const HEIGHT = 88;
const EA_X = 0.62 * WIDTH;

export function BoltzmannTrace({
  activationLabel,
  shadedLabel,
  temperatureK,
}: {
  readonly activationLabel: ReactNode;
  readonly shadedLabel: string;
  readonly temperatureK: number;
}) {
  const samples = useMemo(
    () => sampleBoltzmann(temperatureK, 44),
    [temperatureK]
  );

  const curvePoints = useMemo(
    () =>
      Arr.join(
        Arr.map(
          samples,
          (pt) => `${pt.energy * WIDTH},${HEIGHT - pt.density * (HEIGHT - 10)}`
        ),
        " "
      ),
    [samples]
  );

  const tailPoints = useMemo(() => {
    const tail = Arr.filter(samples, (pt) => pt.aboveEa);
    const coords = Arr.map(
      tail,
      (pt) => `${pt.energy * WIDTH},${HEIGHT - pt.density * (HEIGHT - 10)}`
    );
    return `${EA_X},${HEIGHT} ${Arr.join(coords, " ")} ${WIDTH},${HEIGHT}`;
  }, [samples]);

  return (
    <div className="flex flex-col gap-2">
      <div className="text-muted-foreground flex flex-wrap justify-between gap-x-4 text-xs">
        <span style={{ color: KINETICS_COLORS.activationLine }}>
          {activationLabel}
        </span>
        <span style={{ color: KINETICS_COLORS.shadedArea }}>{shadedLabel}</span>
      </div>
      <div className="relative h-24 px-1 pb-1">
        <div className="border-border relative h-full border-s border-b">
          <svg
            aria-hidden="true"
            className="absolute inset-0 size-full overflow-visible"
            preserveAspectRatio="none"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          >
            <polygon
              fill={KINETICS_COLORS.shadedArea}
              fillOpacity={0.32}
              points={tailPoints}
            />
            <polyline
              fill="none"
              points={curvePoints}
              stroke={KINETICS_COLORS.reactant}
              strokeLinejoin="round"
              strokeWidth={2.2}
              vectorEffect="non-scaling-stroke"
            />
            <line
              stroke={KINETICS_COLORS.activationLine}
              strokeDasharray="3 3"
              strokeWidth={1.6}
              vectorEffect="non-scaling-stroke"
              x1={EA_X}
              x2={EA_X}
              y1={0}
              y2={HEIGHT}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
