"use client";

import { totalOf } from "@repo/design-system/components/contents/mathematics/chart/summary";
import {
  formatInterval,
  intervalOf,
  intervalSeparator,
} from "@repo/design-system/components/contents/mathematics/interval";
import { MATH_NUMBER_OPTIONS } from "@repo/design-system/components/contents/mathematics/number";
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
import { InlineMath } from "@repo/design-system/components/markdown/math";
import {
  VisualCard,
  VisualCardActions,
  VisualCardBody,
  VisualCardFacts,
  VisualCardFooter,
  VisualCardFullscreen,
  VisualCardHeader,
} from "@repo/design-system/components/visual/card";
import { VisualFact } from "@repo/design-system/components/visual/fact";
import {
  fitRegressionLine,
  predictY,
} from "@repo/design-system/lib/charts/regression";
import { getPointSeriesCue } from "@repo/design-system/lib/charts/series-cue";
import { Array as Arr, Option, Record as Rec } from "effect";
import type { ReactNode } from "react";
import { useFormatter, useLocale, useTranslations } from "use-intl";

const REGRESSION_DATA_KEY = "regression";
const DEFAULT_REGRESSION_COLOR = "var(--chart-5)";

/**
 * The readings of a scatter diagram in its footer: its number of points, the
 * interval that its x and y values span, and the mean of its y values.
 */
function ScatterFacts({
  points,
}: {
  points: Arr.NonEmptyReadonlyArray<{ x: number; y: number }>;
}) {
  const t = useTranslations("Common");
  const format = useFormatter();
  const locale = useLocale();
  const separator = intervalSeparator(locale);
  const formatNumber = (value: number) =>
    format.number(value, MATH_NUMBER_OPTIONS);
  const xs = Arr.map(points, (point) => point.x);
  const ys = Arr.map(points, (point) => point.y);

  return (
    <VisualCardFacts>
      <VisualFact
        label={t("points")}
        value={format.number(points.length, MATH_NUMBER_OPTIONS)}
      />
      <VisualFact
        label={<InlineMath math="x" />}
        value={
          <InlineMath
            math={formatInterval(intervalOf(xs), formatNumber, separator)}
          />
        }
      />
      <VisualFact
        label={<InlineMath math="y" />}
        value={
          <InlineMath
            math={formatInterval(intervalOf(ys), formatNumber, separator)}
          />
        }
      />
      <VisualFact
        label={t("mean")}
        value={formatNumber(totalOf(ys) / ys.length)}
      />
    </VisualCardFacts>
  );
}

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

  const points = Arr.flatMap(datasets, (dataset) => dataset.points);
  const regressionLine = calculateRegressionLine
    ? fitRegressionLine(points)
    : Option.none();

  return (
    <VisualCard>
      <VisualCardHeader description={description} title={title} />
      <VisualCardBody className="p-(--card-spacing)">
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
      </VisualCardBody>
      <VisualCardActions>
        <VisualCardFullscreen />
      </VisualCardActions>
      <VisualCardFooter>
        {Arr.isReadonlyArrayNonEmpty(points) ? (
          <ScatterFacts points={points} />
        ) : null}
      </VisualCardFooter>
    </VisualCard>
  );
}
