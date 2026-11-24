import { saturationCurve } from "@repo/design-system/components/contents/biology/saturation/model";
import { ENZYME_COLORS } from "@repo/design-system/lib/material/enzyme";
import { Array as Arr } from "effect";
import type { ReactNode } from "react";

const WIDTH = 200;
const HEIGHT = 96;

/**
 * Compact live rate-against-substrate saturation curve rendered in the card
 * footer, marking the learner's current substrate level and enzymatic plateau.
 */
export function SaturationTrace({
  caption,
  currentRate,
  currentSubstrates,
  enzymes,
  maxRate,
  maxSubstrates,
  turnover,
}: {
  readonly caption: ReactNode;
  readonly currentRate: number;
  readonly currentSubstrates: number;
  readonly enzymes: number;
  readonly maxRate: number;
  readonly maxSubstrates: number;
  readonly turnover: number;
}) {
  const safeSubstrates = Math.max(1, maxSubstrates);
  const safeRate = Math.max(1, maxRate);
  const points = saturationCurve(enzymes, safeSubstrates, turnover, 36);
  const xOf = (value: number) => (value / safeSubstrates) * WIDTH;
  const yOf = (value: number) => HEIGHT - (value / safeRate) * HEIGHT;
  const polyline = Arr.join(
    Arr.map(points, (point) => `${xOf(point.substrates)},${yOf(point.rate)}`),
    " "
  );
  const cursorLeft = `${(currentSubstrates / safeSubstrates) * 100}%`;
  const cursorTop = `${(1 - currentRate / safeRate) * 100}%`;

  return (
    <div className="flex flex-col gap-2">
      <div className="text-muted-foreground text-sm">{caption}</div>
      <div className="relative h-28 ps-2 pe-2 pb-2">
        <div className="border-border relative h-full border-s border-b">
          <svg
            aria-hidden="true"
            className="absolute inset-0 size-full overflow-visible"
            preserveAspectRatio="none"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          >
            <polyline
              fill="none"
              points={polyline}
              stroke={ENZYME_COLORS.curveStroke}
              strokeLinejoin="round"
              strokeWidth={2.25}
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <span
            className="border-background absolute size-3 -translate-1/2 rounded-full border-2"
            style={{
              backgroundColor: ENZYME_COLORS.curveCursor,
              left: cursorLeft,
              top: cursorTop,
            }}
          />
        </div>
      </div>
    </div>
  );
}
