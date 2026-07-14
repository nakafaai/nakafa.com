import {
  GLBB_SCENARIOS,
  type GlbbLabels,
  type GlbbScenario,
  getFinalVelocity,
} from "@repo/design-system/components/contents/physics/kinematics/non-uniform-linear-motion/data";
import {
  Area,
  EvilAreaChart,
  Grid,
  XAxis,
  YAxis,
} from "@repo/design-system/components/evilcharts/charts/area-chart";
import type { ChartConfig } from "@repo/design-system/components/evilcharts/ui/chart-config";
import {
  ChartTooltip,
  ChartTooltipContent,
} from "@repo/design-system/components/evilcharts/ui/tooltip";

const MAX_TIME = getAxisMaximum(
  Math.max(...GLBB_SCENARIOS.map((scenario) => scenario.duration)),
  1
);
const MAX_OBSERVED_VELOCITY = Math.max(
  ...GLBB_SCENARIOS.flatMap((scenario) => [
    scenario.initialVelocity,
    getFinalVelocity(scenario),
  ])
);
const VELOCITY_TICK_STEP = getNiceTickStep(MAX_OBSERVED_VELOCITY);
const MAX_VELOCITY = getAxisMaximum(MAX_OBSERVED_VELOCITY, VELOCITY_TICK_STEP);
const TIME_TICKS = getTicks(MAX_TIME, 1);
const VELOCITY_TICKS = getTicks(MAX_VELOCITY, VELOCITY_TICK_STEP);
const SCENARIO_CHART_COLORS = {
  "from-rest": "var(--chart-1)",
  "speed-up": "var(--chart-2)",
  brake: "var(--chart-3)",
} satisfies Record<GlbbScenario["id"], string>;

export function VelocityTimeGraph({
  labels,
  scenario,
}: {
  labels: GlbbLabels;
  scenario: GlbbScenario;
}) {
  const finalVelocity = getFinalVelocity(scenario);
  const scenarioChartColor = SCENARIO_CHART_COLORS[scenario.id];
  const chartConfig = {
    velocity: {
      label: labels.velocityAxis,
      colors: {
        light: [scenarioChartColor],
        dark: [scenarioChartColor],
      },
    },
  } satisfies ChartConfig;
  const chartData = [
    { time: 0, velocity: scenario.initialVelocity },
    { time: scenario.duration, velocity: finalVelocity },
  ];

  return (
    <EvilAreaChart
      chartProps={{ margin: CHART_MARGIN }}
      className="aspect-[1.45] sm:aspect-video"
      config={chartConfig}
      data={chartData}
    >
      <Grid />
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
        areaProps={{
          activeDot: { r: 4 },
          baseValue: 0,
          dot: { r: 3.5 },
          fillOpacity: 0.22,
          name: labels.velocityAxis,
          strokeLinecap: "round",
          strokeOpacity: 1,
          strokeWidth: 2,
        }}
        dataKey="velocity"
        variant="solid"
      />
    </EvilAreaChart>
  );
}

const CHART_MARGIN = {
  top: 20,
  right: 24,
  bottom: 8,
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

function getAxisMaximum(maxValue: number, step: number) {
  return Math.ceil(maxValue / step) * step;
}

function getNiceTickStep(maxValue: number) {
  const targetTickCount = 6;
  const rawStep = maxValue / (targetTickCount - 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalizedStep = rawStep / magnitude;

  if (normalizedStep <= 1) {
    return magnitude;
  }

  if (normalizedStep <= 2) {
    return 2 * magnitude;
  }

  if (normalizedStep <= 5) {
    return 5 * magnitude;
  }

  return 10 * magnitude;
}
