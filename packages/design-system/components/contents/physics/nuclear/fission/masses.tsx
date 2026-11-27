import { Bar } from "@repo/design-system/components/evilcharts/charts/composed/bar";
import {
  EvilComposedChart,
  Grid,
  Legend,
  XAxis,
  YAxis,
} from "@repo/design-system/components/evilcharts/charts/composed-chart";
import { InlineMath } from "@repo/design-system/components/markdown/math";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Array as Arr, Option } from "effect";
import type { ReactNode } from "react";
import { useFormatter } from "use-intl";

const MARGIN = { bottom: 4, left: 0, right: 16, top: 12 };

/**
 * The two totals of a fission weighed side by side, in the card's footer:
 * the mass that went in and the mass that came out, in atomic mass units.
 * The axis starts just below the lighter total, so the small defect between
 * the two bars shows.
 */
export function Masses({
  after,
  before,
}: {
  readonly after: { readonly label: ReactNode; readonly mass: number };
  readonly before: { readonly label: ReactNode; readonly mass: number };
}) {
  const formatter = useFormatter();
  const step = 10 ** Math.ceil(Math.log10(before.mass - after.mass)) / 2;
  const low = (Math.floor(after.mass / step) - 1) * step;
  const ticks = Arr.makeBy(
    Math.ceil((before.mass - low) / step) + 1,
    (index) => low + index * step
  );
  const config = {
    after: {
      colors: { dark: [PLOT_COLORS.teal], light: [PLOT_COLORS.teal] },
      label: after.label,
    },
    before: {
      colors: { dark: [PLOT_COLORS.pink], light: [PLOT_COLORS.pink] },
      label: before.label,
    },
  };

  return (
    <div className="flex flex-col gap-1 p-(--card-spacing) pb-0">
      <span className="text-muted-foreground text-xs">
        <InlineMath math="m\,(\text{u})" />
      </span>
      <EvilComposedChart
        animationType="none"
        chartProps={{ margin: MARGIN }}
        className="aspect-[1.5] max-h-60 sm:aspect-[2.4]"
        config={config}
        data={[{ after: after.mass, before: before.mass, name: "" }]}
      >
        <Grid vertical={false} />
        <XAxis dataKey="name" tick={false} />
        <YAxis
          allowDataOverflow
          domain={[low, Option.getOrElse(Arr.last(ticks), () => before.mass)]}
          tickFormatter={(value: number) =>
            formatter.number(value, "math", { maximumFractionDigits: 2 })
          }
          tickMargin={6}
          ticks={ticks}
          type="number"
          width={56}
        />
        <Bar barProps={{ tooltipType: "none" }} dataKey="before" />
        <Bar barProps={{ tooltipType: "none" }} dataKey="after" />
        <Legend verticalAlign="bottom" />
      </EvilComposedChart>
    </div>
  );
}
