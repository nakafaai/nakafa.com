import {
  categoryLayout,
  TICK_GUTTER,
} from "@repo/design-system/components/contents/mathematics/chart/axis";
import { Array as Arr } from "effect";
import {
  Text,
  usePlotArea,
  useXAxisTicks,
  type XAxisTickContentProps,
} from "recharts";

/** The slant of a label that its band is too narrow to hold upright, steep enough that the first label stays inside the chart. */
const SLANT = -60;

/**
 * One label of a category axis that Recharts draws for every category
 * (`interval={0}`): wrapped within its band, or slanted with the rest of the
 * axis when a word would not fit its band. The axis measures the labels it
 * draws (`height="auto"`), so it grows to hold them.
 */
export function CategoryTick({
  className,
  fill,
  payload,
  textAnchor = "middle",
  verticalAnchor = "start",
  visibleTicksCount,
  x = 0,
  y = 0,
}: Partial<XAxisTickContentProps>) {
  const plot = usePlotArea();
  const ticks = useXAxisTicks();
  if (plot === undefined || ticks === undefined || payload === undefined) {
    return null;
  }
  const band = plot.width / Math.max(1, visibleTicksCount ?? ticks.length);
  const layout = categoryLayout({
    band,
    labels: Arr.map(ticks, (tick) => String(tick.value)),
  });
  return (
    <Text
      className={className}
      fill={fill}
      x={x}
      y={y}
      {...(layout === "wrap"
        ? { textAnchor, verticalAnchor, width: band - TICK_GUTTER }
        : { angle: SLANT, textAnchor: "end", verticalAnchor: "middle" })}
    >
      {String(payload.value)}
    </Text>
  );
}
