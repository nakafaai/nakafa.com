"use client";

import { useChartData } from "@repo/design-system/components/contents/mathematics/chart/context";
import {
  summarizeSeries,
  totalOf,
} from "@repo/design-system/components/contents/mathematics/chart/summary";
import { MATH_NUMBER_OPTIONS } from "@repo/design-system/components/contents/mathematics/number";
import { VisualCardFacts } from "@repo/design-system/components/visual/card";
import {
  VisualFact,
  VisualFactIndicator,
} from "@repo/design-system/components/visual/fact";
import { Array as Arr, Option } from "effect";
import { useFormatter, useTranslations } from "next-intl";

/**
 * The four readings of a chart with one series, in its footer: the category of
 * its highest value and of its lowest, its total, and its mean.
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

  const { highest, lowest, mean, total } = summary.value;
  const formatNumber = (value: number) =>
    format.number(value, MATH_NUMBER_OPTIONS);

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
      <VisualFact label={t("total")} value={formatNumber(total)} />
      <VisualFact label={t("mean")} value={formatNumber(mean)} />
    </VisualCardFacts>
  );
}

/**
 * One reading for each series of a chart, in its footer: the total of the series
 * over every category, labelled with the series and marked with its color.
 */
export function ChartSeriesFacts() {
  const format = useFormatter();
  const { series } = useChartData();

  return (
    <VisualCardFacts>
      {Arr.map(series, (item) => (
        <VisualFactIndicator
          indicatorColor={item.color}
          key={item.key}
          label={item.label}
          value={format.number(totalOf(item.values), MATH_NUMBER_OPTIONS)}
        />
      ))}
    </VisualCardFacts>
  );
}
