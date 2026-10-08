"use client";

import {
  ActiveDot,
  Dot,
  Line,
} from "@repo/design-system/components/evilcharts/charts/composed/line";
import { Scatter } from "@repo/design-system/components/evilcharts/charts/composed/scatter";
import {
  EvilComposedChart,
  Grid,
  Legend,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "@repo/design-system/components/evilcharts/charts/composed-chart";
import type { ChartConfig } from "@repo/design-system/components/evilcharts/ui/chart-config";
import {
  VisualCard,
  VisualCardBody,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardHeader,
  VisualCardScene,
} from "@repo/design-system/components/visual/card";
import {
  fitRegressionLine,
  predictY,
} from "@repo/design-system/lib/charts/regression";
import { getPointSeriesCue } from "@repo/design-system/lib/charts/series-cue";
import { Array as Arr, Option, Record as Rec } from "effect";
import type { ReactNode } from "react";

const REGRESSION_DATA_KEY = "regression";
const DEFAULT_REGRESSION_COLOR = "var(--chart-5)";

interface Props {
  calculateRegressionLine?: boolean;
  /** Each named series of points, drawn in its own color. */
  datasets: {
    color: string;
    name: string;
    points: { x: number; y: number }[];
  }[];
  description: ReactNode;
  regressionLineStyle?: {
    color?: string;
    strokeDasharray?: string;
  };
  showResiduals?: boolean;
  title: ReactNode;
  xAxisDomain?: "min-max";
  xAxisLabel?: string;
  yAxisLabel?: string;
}

export function ScatterDiagram({
  title,
  description,
  xAxisLabel,
  yAxisLabel,
  xAxisDomain,
  datasets,
  calculateRegressionLine,
  regressionLineStyle,
  showResiduals,
}: Props) {
  const datasetConfig = Rec.fromEntries(
    Arr.map(datasets, (dataset, index) => [
      dataset.name,
      {
        cue: getPointSeriesCue(index),
        label: dataset.name,
        colors: { light: [dataset.color], dark: [dataset.color] },
      },
    ])
  );
  const chartConfig = {
    x: { label: xAxisLabel || "X" },
    y: { label: yAxisLabel || "Y" },
    [REGRESSION_DATA_KEY]: {
      label: "Regresi",
      colors: {
        light: [regressionLineStyle?.color || DEFAULT_REGRESSION_COLOR],
        dark: [regressionLineStyle?.color || DEFAULT_REGRESSION_COLOR],
      },
    },
    ...datasetConfig,
  } satisfies ChartConfig;
  const chartData = Arr.flatMap(datasets, (dataset) =>
    Arr.map(dataset.points, (point) => ({
      x: point.x,
      y: point.y,
      [dataset.name]: point.y,
    }))
  );

  const regressionLine = calculateRegressionLine
    ? fitRegressionLine(Arr.flatMap(datasets, (dataset) => dataset.points))
    : Option.none();

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody>
        <VisualCardScene>
          <EvilComposedChart config={chartConfig} data={chartData}>
            <Grid vertical={false} />
            <XAxis
              dataKey="x"
              {...(xAxisDomain === "min-max"
                ? { domain: ["dataMin", "dataMax"] }
                : {})}
              label={{
                value: xAxisLabel || "X",
                position: "bottom",
                offset: 10,
                style: { textAnchor: "middle" },
              }}
              tickFormatter={(value) => value.toString()}
              tickMargin={8}
              type="number"
            />
            <YAxis
              dataKey="y"
              label={{
                value: yAxisLabel || "Y",
                angle: -90,
                position: "insideLeft",
                style: { textAnchor: "middle" },
              }}
              tickMargin={8}
              type="number"
            />
            <Tooltip hideContent />
            {Arr.map(datasets, (dataset, index) => {
              const cue = getPointSeriesCue(index);

              return (
                <Scatter
                  data={dataset.points}
                  dataKey={dataset.name}
                  key={dataset.name}
                >
                  <Dot variant={cue.dot} />
                  <ActiveDot variant={cue.activeDot} />
                </Scatter>
              );
            })}
            {Option.isSome(regressionLine) && (
              <Line
                dataKey={REGRESSION_DATA_KEY}
                lineProps={{
                  activeDot: false,
                  data: Arr.map(
                    [regressionLine.value.xMin, regressionLine.value.xMax],
                    (x) => ({
                      x,
                      [REGRESSION_DATA_KEY]: predictY(regressionLine.value, x),
                    })
                  ),
                  dot: false,
                  legendType: "none",
                  ...(regressionLineStyle?.strokeDasharray === undefined
                    ? {}
                    : {
                        strokeDasharray: regressionLineStyle?.strokeDasharray,
                      }),
                  strokeWidth: 2,
                  tooltipType: "none",
                }}
              />
            )}
            {!!showResiduals &&
              Option.isSome(regressionLine) &&
              Arr.flatMap(datasets, (dataset) =>
                Arr.map(dataset.points, (point) => {
                  const yPredicted = predictY(regressionLine.value, point.x);

                  return (
                    <ReferenceLine
                      ifOverflow="visible"
                      key={`${dataset.name}-residual-${point.x}-${point.y}-${yPredicted}`}
                      segment={[
                        { x: point.x, y: point.y },
                        { x: point.x, y: yPredicted },
                      ]}
                      stroke={dataset.color}
                      strokeDasharray="2 2"
                    />
                  );
                })
              )}
            <Legend variant="circle" />
          </EvilComposedChart>
        </VisualCardScene>
      </VisualCardBody>
      <VisualCardFooter>
        <VisualCardFullscreen />
      </VisualCardFooter>
    </VisualCard>
  );
}
