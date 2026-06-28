import {
  type AccelerationCase,
  type AccelerationLabels,
  getMotionPoints,
} from "@repo/design-system/components/contents/physics/kinematics/acceleration/data";
import {
  EvilLineChart,
  Grid,
  Line,
  XAxis,
  YAxis,
} from "@repo/design-system/components/evilcharts/charts/line-chart";
import type { ChartConfig } from "@repo/design-system/components/evilcharts/ui/chart-config";
import {
  ChartTooltip,
  ChartTooltipContent,
} from "@repo/design-system/components/evilcharts/ui/tooltip";

interface AccelerationGraphProps {
  labels: AccelerationLabels;
  selectedCase: AccelerationCase;
}

const MOTION_POINTS = getMotionPoints();
const MAX_OBSERVED_TIME = Math.max(...MOTION_POINTS.map((point) => point.time));
const MAX_OBSERVED_VELOCITY = Math.max(
  ...MOTION_POINTS.map((point) => point.velocity)
);
const TIME_TICK_STEP = getNiceTickStep(MAX_OBSERVED_TIME, 7);
const VELOCITY_TICK_STEP = getNiceTickStep(MAX_OBSERVED_VELOCITY, 6);
const MAX_TIME = getAxisMaximum(MAX_OBSERVED_TIME, TIME_TICK_STEP);
const MAX_VELOCITY = getAxisMaximum(MAX_OBSERVED_VELOCITY, VELOCITY_TICK_STEP);
const TIME_TICKS = getTicks(MAX_TIME, TIME_TICK_STEP);
const VELOCITY_TICKS = getTicks(MAX_VELOCITY, VELOCITY_TICK_STEP);

export function AccelerationGraph({
  labels,
  selectedCase,
}: AccelerationGraphProps) {
  const chartConfig = {
    motion: {
      label: labels.contextLine,
    },
    selected: {
      label: labels.scenarioNames[selectedCase.id],
      colors: {
        light: [selectedCase.color],
        dark: [selectedCase.color],
      },
    },
  } satisfies ChartConfig;

  const motionData = MOTION_POINTS.map((point) => ({
    time: point.time,
    motion: point.velocity,
    selected: null,
  }));
  const selectedData = [
    { time: selectedCase.t0, selected: selectedCase.v0 },
    { time: selectedCase.t1, selected: selectedCase.v1 },
  ];

  return (
    <EvilLineChart
      chartProps={{ margin: CHART_MARGIN }}
      className="aspect-[1.45] sm:aspect-video"
      config={chartConfig}
      data={motionData}
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
      <Line
        dataKey="motion"
        lineProps={{
          activeDot: false,
          dot: false,
          name: labels.contextLine,
          stroke: "var(--muted-foreground)",
          strokeDasharray: "6 6",
          strokeLinecap: "round",
          strokeOpacity: 0.5,
          strokeWidth: 1.5,
        }}
      />
      <Line
        dataKey="selected"
        key={selectedCase.id}
        lineProps={{
          data: selectedData,
          dot: { r: 3.5 },
          name: labels.scenarioNames[selectedCase.id],
          strokeLinecap: "round",
          strokeWidth: 3,
        }}
      />
    </EvilLineChart>
  );
}

function getTicks(maxValue: number, step: number) {
  const tickCount = Math.floor(maxValue / step) + 1;

  return Array.from({ length: tickCount }, (_, index) => index * step);
}

function getAxisMaximum(maxValue: number, step: number) {
  return Math.ceil(maxValue / step) * step;
}

function getNiceTickStep(maxValue: number, targetTickCount: number) {
  if (maxValue <= 0) {
    return 1;
  }

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
