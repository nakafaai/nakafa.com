"use client";

import type { StyleProps } from "@repo/design-system/components/evilcharts/charts/composed/bars";
import {
  ActiveDot,
  Dot,
  type DotProps,
} from "@repo/design-system/components/evilcharts/charts/composed/line";
import {
  getOpacity,
  useComposedChart,
} from "@repo/design-system/components/evilcharts/charts/composed-chart";
import {
  type ChartConfig,
  getChartColorVariable,
  getChartSeriesId,
  getColorsCount,
} from "@repo/design-system/components/evilcharts/ui/chart-config";
import { ChartDot } from "@repo/design-system/components/evilcharts/ui/dot";
import {
  Children,
  type ComponentProps,
  isValidElement,
  type ReactNode,
  useId,
} from "react";
import { Scatter as RechartsScatter } from "recharts";

type ScatterShapeProp = ComponentProps<typeof RechartsScatter>["shape"];

type ScatterActiveShapeProp = ComponentProps<
  typeof RechartsScatter
>["activeShape"];

interface ScatterProps
  extends Omit<
    ComponentProps<typeof RechartsScatter>,
    "activeShape" | "dataKey" | "fill" | "name" | "shape"
  > {
  children?: ReactNode; // optional <Dot /> and <ActiveDot /> composition
  dataKey: string; // chart config key used for color, legend, and tooltip labels
}

/**
 * A scatter series for free x/y points. EvilCharts does not document a scatter
 * primitive, so this part keeps the EvilCharts root/config contract while using
 * Recharts' native Scatter geometry instead of faking points with a line.
 */
export function Scatter({ dataKey, children, ...scatterProps }: ScatterProps) {
  const { config, isLoading, selectedDataKey } = useComposedChart();
  const id = useId().replace(/:/g, "");

  if (isLoading) {
    return null;
  }

  const opacity = getOpacity(selectedDataKey, dataKey);
  const chartId = `${id}-scatter`;
  const { shape, activeShape } = resolveScatterShapes(
    children,
    chartId,
    dataKey,
    opacity.dot
  );

  return (
    <>
      <RechartsScatter
        activeShape={activeShape}
        fill={`url(#${getChartSeriesId(chartId, "colors", dataKey)})`}
        isAnimationActive={false}
        legendType="circle"
        name={dataKey}
        shape={shape}
        {...scatterProps}
      />
      <defs>
        <ScatterColorGradient config={config} dataKey={dataKey} id={chartId} />
      </defs>
    </>
  );
}

// Pulls <Dot /> and <ActiveDot /> into Recharts Scatter shape slots.
const resolveScatterShapes = (
  children: ReactNode,
  id: string,
  dataKey: string,
  dotOpacity: number
): { shape: ScatterShapeProp; activeShape: ScatterActiveShapeProp } => {
  let shape: ScatterShapeProp = (
    <ChartDot
      chartId={id}
      dataKey={dataKey}
      fillOpacity={dotOpacity}
      type="default"
    />
  );
  let activeShape: ScatterActiveShapeProp = (
    <ChartDot
      chartId={id}
      dataKey={dataKey}
      fillOpacity={dotOpacity}
      type="colored-border"
    />
  );

  Children.forEach(children, (child) => {
    if (!isValidElement<DotProps>(child)) {
      return;
    }

    if (child.type === Dot) {
      const { variant } = child.props;
      shape = (
        <ChartDot
          chartId={id}
          dataKey={dataKey}
          fillOpacity={dotOpacity}
          type={variant}
        />
      );
    }

    if (child.type === ActiveDot) {
      const { variant } = child.props;
      activeShape = (
        <ChartDot
          chartId={id}
          dataKey={dataKey}
          fillOpacity={dotOpacity}
          type={variant}
        />
      );
    }
  });

  return { shape, activeShape };
};

/** Solid series gradient used by scatter dots and their active shape. */
const ScatterColorGradient = ({
  id,
  dataKey,
  config,
}: StyleProps & { config: ChartConfig }) => {
  const colorsCount = getColorsCount(config[dataKey] ?? {});

  return (
    <linearGradient
      id={getChartSeriesId(id, "colors", dataKey)}
      x1="0"
      x2="1"
      y1="0"
      y2="0"
    >
      {colorsCount === 1 ? (
        <>
          <stop offset="0%" stopColor={getChartColorVariable(dataKey, 0)} />
          <stop offset="100%" stopColor={getChartColorVariable(dataKey, 0)} />
        </>
      ) : (
        Array.from({ length: colorsCount }, (_, index) => {
          const offset = `${(index / (colorsCount - 1)) * 100}%`;
          return (
            <stop
              key={offset}
              offset={offset}
              stopColor={getChartColorVariable(dataKey, index, 0)}
            />
          );
        })
      )}
    </linearGradient>
  );
};
