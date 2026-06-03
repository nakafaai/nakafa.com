import {
  type AccelerationCase,
  type AccelerationLabels,
  getDeltaVelocity,
  getMotionPoints,
} from "@repo/design-system/components/contents/physics/kinematics/acceleration/data";
import type { ChartConfig } from "@repo/design-system/components/ui/chart";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  getColorVariable,
} from "@repo/design-system/components/ui/chart";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";

interface AccelerationGraphProps {
  labels: AccelerationLabels;
  selectedCase: AccelerationCase;
}

const MAX_TIME = 12;
const MAX_VELOCITY = 12;
const TIME_TICKS = getTicks(MAX_TIME, 2);
const VELOCITY_TICKS = getTicks(MAX_VELOCITY, 2);

interface GuideSegment {
  points: readonly [GuidePoint, GuidePoint];
}

interface GuidePoint {
  x: number;
  y: number;
}

export function AccelerationGraph({
  labels,
  selectedCase,
}: AccelerationGraphProps) {
  const chartConfig = {
    selected: {
      label: labels.scenarioNames[selectedCase.id],
      colors: {
        light: [selectedCase.color],
        dark: [selectedCase.color],
      },
    },
  } satisfies ChartConfig;

  const motionPoints = getMotionPoints();
  const motionData = motionPoints.map((point) => ({
    time: point.time,
    motion: point.velocity,
  }));
  const selectedData = [
    { time: selectedCase.t0, selected: selectedCase.v0 },
    { time: selectedCase.t1, selected: selectedCase.v1 },
  ];
  const guideSegments = getGuideSegments(selectedCase);

  return (
    <ChartContainer
      className="aspect-[1.45] sm:aspect-video"
      config={chartConfig}
    >
      <LineChart accessibilityLayer data={motionData} margin={CHART_MARGIN}>
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
        {getMotionSegments(motionPoints).map((segment) => (
          <ReferenceLine
            ifOverflow="visible"
            key={`${segment[0].x}-${segment[0].y}-${segment[1].x}-${segment[1].y}`}
            segment={segment}
            stroke="var(--muted-foreground)"
            strokeDasharray="7 7"
            strokeOpacity={0.72}
            strokeWidth={1.5}
          />
        ))}
        {guideSegments.map((segment) => (
          <ReferenceLine
            ifOverflow="visible"
            key={`${segment.points[0].x}-${segment.points[0].y}-${segment.points[1].x}-${segment.points[1].y}`}
            segment={segment.points}
            stroke="var(--muted-foreground)"
            strokeDasharray="6 6"
            strokeOpacity={0.72}
            strokeWidth={1}
          />
        ))}
        <Line
          data={selectedData}
          dataKey="selected"
          dot={{ r: 3.5 }}
          name={labels.scenarioNames[selectedCase.id]}
          stroke={getColorVariable("selected", 0)}
          strokeLinecap="round"
          strokeWidth={2}
          type="linear"
        />
      </LineChart>
    </ChartContainer>
  );
}

function getMotionSegments(points: ReturnType<typeof getMotionPoints>) {
  const segments: Array<readonly [GuidePoint, GuidePoint]> = [];

  for (let index = 1; index < points.length; index += 1) {
    const previousPoint = points[index - 1];
    const currentPoint = points[index];

    if (!(previousPoint && currentPoint)) {
      continue;
    }

    segments.push([
      { x: previousPoint.time, y: previousPoint.velocity },
      { x: currentPoint.time, y: currentPoint.velocity },
    ]);
  }

  return segments;
}

function getTicks(maxValue: number, step: number) {
  const tickCount = Math.floor(maxValue / step) + 1;

  return Array.from({ length: tickCount }, (_, index) => index * step);
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

function getGuideSegments(selectedCase: AccelerationCase): GuideSegment[] {
  const horizontalSegment: GuideSegment = {
    points: [
      { x: selectedCase.t0, y: selectedCase.v0 },
      { x: selectedCase.t1, y: selectedCase.v0 },
    ],
  };

  if (getDeltaVelocity(selectedCase) === 0) {
    return [horizontalSegment];
  }

  return [
    horizontalSegment,
    {
      points: [
        { x: selectedCase.t1, y: selectedCase.v0 },
        { x: selectedCase.t1, y: selectedCase.v1 },
      ],
    },
  ];
}
