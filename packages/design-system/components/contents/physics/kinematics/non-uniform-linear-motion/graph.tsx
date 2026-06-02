import {
  type GlbbLabels,
  type GlbbScenario,
  getFinalVelocity,
} from "@repo/design-system/components/contents/physics/kinematics/non-uniform-linear-motion/data";
import type { ChartConfig } from "@repo/design-system/components/ui/chart";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  getColorVariable,
} from "@repo/design-system/components/ui/chart";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

const MAX_TIME = 6;
const MAX_VELOCITY = 12;
const TIME_TICKS = getTicks(MAX_TIME, 1);
const VELOCITY_TICKS = getTicks(MAX_VELOCITY, 2);

export function VelocityTimeGraph({
  labels,
  scenario,
}: {
  labels: GlbbLabels;
  scenario: GlbbScenario;
}) {
  const finalVelocity = getFinalVelocity(scenario);
  const chartConfig = {
    velocity: {
      label: labels.velocityAxis,
      colors: {
        light: [scenario.color],
        dark: [scenario.color],
      },
    },
  } satisfies ChartConfig;
  const chartData = [
    { time: 0, velocity: scenario.initialVelocity },
    { time: scenario.duration, velocity: finalVelocity },
  ];

  return (
    <ChartContainer
      className="aspect-[1.45] sm:aspect-video"
      config={chartConfig}
    >
      <AreaChart accessibilityLayer data={chartData} margin={CHART_MARGIN}>
        <CartesianGrid />
        <XAxis
          dataKey="time"
          domain={[0, MAX_TIME]}
          height={56}
          label={{
            value: labels.timeAxis,
            position: "insideBottomRight",
            offset: 8,
          }}
          tickMargin={8}
          ticks={TIME_TICKS}
          type="number"
        />
        <YAxis
          domain={[0, MAX_VELOCITY]}
          label={{
            value: labels.velocityAxis,
            angle: -90,
            position: "insideLeft",
            style: { textAnchor: "middle" },
          }}
          tickMargin={8}
          ticks={VELOCITY_TICKS}
          type="number"
        />
        <ChartTooltip
          content={<ChartTooltipContent labelFormatter={formatTooltipTime} />}
        />
        <Area
          activeDot={{ r: 4 }}
          baseValue={0}
          dataKey="velocity"
          dot={{ r: 3.5 }}
          fill={getColorVariable("velocity", 0)}
          fillOpacity={0.22}
          name={labels.velocityAxis}
          stroke={getColorVariable("velocity", 0)}
          strokeLinecap="round"
          strokeWidth={2}
          type="linear"
        />
        <ChartLegend content={<ChartLegendContent verticalAlign="bottom" />} />
      </AreaChart>
    </ChartContainer>
  );
}

const CHART_MARGIN = {
  top: 20,
  right: 24,
  bottom: 36,
  left: 8,
};

interface TooltipPayloadItem {
  payload?: {
    time?: unknown;
  };
}

function formatTooltipTime(
  _: unknown,
  payload: readonly TooltipPayloadItem[] = []
) {
  const time = payload[0]?.payload?.time;

  if (typeof time !== "number") {
    return "t";
  }

  return `t = ${time} s`;
}

function getTicks(maxValue: number, step: number) {
  const tickCount = Math.floor(maxValue / step) + 1;

  return Array.from({ length: tickCount }, (_, index) => index * step);
}
