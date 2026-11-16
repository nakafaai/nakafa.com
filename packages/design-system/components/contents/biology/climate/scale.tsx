import {
  BUDGET,
  RECORD_SPAN,
} from "@repo/design-system/components/contents/biology/climate/budget";
import { useQuantity } from "@repo/design-system/components/contents/simulation/quantity";
import { InlineMath } from "@repo/design-system/components/markdown/math";

/** The chart's axes: CO2 in ppm and the years, for the record and for pathways, which run to 2100. */
export const CHART_AXES = {
  pathway: { first: BUDGET.startYear, high: 560, last: 2100, low: 380 },
  record: {
    first: RECORD_SPAN.first,
    high: 440,
    last: RECORD_SPAN.last,
    low: 300,
  },
} as const;

/**
 * The values on the chart's axes, written over the sketch where its axes
 * stand: the CO2 level in ppm just inside the vertical axis at its top and
 * middle and just above the horizontal axis at its bottom, clear of the tub
 * and its waste, and the first and last year under the horizontal one. The
 * sketch places its chart at the same shares of its width and height.
 */
export function ChartScale({ record }: { readonly record: boolean }) {
  const quantity = useQuantity();
  const { first, high, last, low } = record
    ? CHART_AXES.record
    : CHART_AXES.pathway;
  return (
    <div
      aria-hidden="true"
      className="text-muted-foreground pointer-events-none absolute inset-0 text-xs"
    >
      <span className="absolute top-[3%] left-[46%] -translate-x-1/2">
        <InlineMath math="\text{ppm}" />
      </span>
      <span className="absolute top-[12%] left-[46%] -translate-y-1/2 ps-1.5">
        <InlineMath math={quantity(high, "", 0)} />
      </span>
      <span className="absolute top-[49%] left-[46%] -translate-y-1/2 ps-1.5">
        <InlineMath math={quantity((low + high) / 2, "", 0)} />
      </span>
      <span className="absolute top-[86%] left-[46%] -translate-y-full ps-1.5 pb-0.5">
        <InlineMath math={quantity(low, "", 0)} />
      </span>
      <span className="absolute top-[89%] left-[46%] -translate-x-1/2">
        {first}
      </span>
      <span className="absolute top-[89%] right-4 translate-x-1/2">{last}</span>
    </div>
  );
}
