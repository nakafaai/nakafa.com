import { useChartData } from "@repo/design-system/components/contents/mathematics/chart/context";
import { summarizeSeries } from "@repo/design-system/components/contents/mathematics/chart/summary";

import { VisualCardFacts } from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import { Array as Arr, Option } from "effect";
import { useFormatter, useTranslations } from "use-intl";

/**
 * The four readings of a chart with one series, in its footer: the category of
 * its highest value and of its lowest, the range between them, and its mean.
 */
export function ChartSummaryFacts() {
  const t = useTranslations("Common");
  const format = useFormatter();
  const { categories, series } = useChartData();
  const summary = Option.flatMap(Arr.head(series), (first) =>
    summarizeSeries(categories, first.values)
  );
  if (Option.isNone(summary)) {
    return null;
  }

  const { highest, lowest, mean, range } = summary.value;
  const formatNumber = (value: number) => format.number(value, "math");

  return (
    <VisualCardFacts>
      <VisualFact
        label={t("highest")}
        value={`${highest.category}: ${formatNumber(highest.value)}`}
      />
      <VisualFact
        label={t("lowest")}
        value={`${lowest.category}: ${formatNumber(lowest.value)}`}
      />
      <VisualFact label={t("range")} value={formatNumber(range)} />
      <VisualFact label={t("mean")} value={formatNumber(mean)} />
    </VisualCardFacts>
  );
}
