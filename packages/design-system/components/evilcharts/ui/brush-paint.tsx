import {
  type ChartConfig,
  getChartColorVariable,
  getChartSeriesId,
  getColorsCount,
} from "@repo/design-system/components/evilcharts/ui/chart-config";
import type { EvilBrushVariant } from "@repo/design-system/components/evilcharts/ui/evil-brush";
import { Array as Arr, MutableHashSet, Record as Rec } from "effect";
import type { ReactNode } from "react";

interface BrushDefinitionsProps {
  chartConfig: ChartConfig;
  chartId: string;
  keys: string[];
  variant: EvilBrushVariant;
}

/** Renders the color stops for one brush preview series. */
function BrushStops({
  colorsCount,
  dataKey,
}: {
  colorsCount: number;
  dataKey: string;
}) {
  if (colorsCount === 1) {
    return (
      <>
        <stop offset="0%" stopColor={getChartColorVariable(dataKey, 0)} />
        <stop offset="100%" stopColor={getChartColorVariable(dataKey, 0)} />
      </>
    );
  }

  return (
    <>
      {Array.from({ length: colorsCount }, (_, index) => {
        const offset = `${(index / (colorsCount - 1)) * 100}%`;

        return (
          <stop
            key={`${dataKey}-${offset}`}
            offset={offset}
            stopColor={getChartColorVariable(dataKey, index, 0)}
          />
        );
      })}
    </>
  );
}

/** Renders the gradient, given its color stops as children, and the optional area mask for one preview series. */
function BrushGradient({
  chartId,
  children,
  dataKey,
  variant,
}: {
  chartId: string;
  children: ReactNode;
  dataKey: string;
  variant: EvilBrushVariant;
}) {
  return (
    <>
      <linearGradient
        id={getChartSeriesId(chartId, "zm", dataKey)}
        x1="0"
        x2="0"
        y1="0"
        y2="1"
      >
        {children}
      </linearGradient>

      {variant === "area" ? (
        <>
          <mask id={getChartSeriesId(chartId, "zm-fill-mask", dataKey)}>
            <rect
              fill={`url(#${chartId}-zm-vertical-fade)`}
              height="100%"
              width="100%"
            />
          </mask>
          <pattern
            height="100%"
            id={getChartSeriesId(chartId, "zm-fill", dataKey)}
            patternUnits="userSpaceOnUse"
            width="100%"
          >
            <rect
              fill={`url(#${getChartSeriesId(chartId, "zm", dataKey)})`}
              height="100%"
              mask={`url(#${getChartSeriesId(chartId, "zm-fill-mask", dataKey)})`}
              width="100%"
            />
          </pattern>
        </>
      ) : null}
    </>
  );
}

/** Renders the SVG definitions shared by every brush preview variant. */
export function BrushDefinitions({
  chartConfig,
  chartId,
  keys,
  variant,
}: BrushDefinitionsProps) {
  const visibleKeys = MutableHashSet.fromIterable(keys);

  return (
    <>
      {variant === "area" ? (
        <linearGradient
          id={`${chartId}-zm-vertical-fade`}
          x1="0"
          x2="0"
          y1="0"
          y2="1"
        >
          <stop offset="0%" stopColor="white" stopOpacity={0.15} />
          <stop offset="100%" stopColor="white" stopOpacity={0} />
        </linearGradient>
      ) : null}
      {Arr.flatMap(Rec.toEntries(chartConfig), ([dataKey, config]) => {
        if (!MutableHashSet.has(visibleKeys, dataKey)) {
          return [];
        }

        return [
          <BrushGradient
            chartId={chartId}
            dataKey={dataKey}
            key={dataKey}
            variant={variant}
          >
            <BrushStops
              colorsCount={getColorsCount(config)}
              dataKey={dataKey}
            />
          </BrushGradient>,
        ];
      })}
    </>
  );
}
