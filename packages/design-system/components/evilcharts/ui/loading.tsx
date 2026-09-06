"use client";

import { LoadingShimmer } from "@repo/design-system/components/evilcharts/ui/shimmer";
import type { ComponentProps } from "react";
import {
  Area as RechartsArea,
  Bar as RechartsBar,
  Line as RechartsLine,
} from "recharts";

/**
 * The skeleton area shown while the chart is loading. Rendered by the root in
 * place of the real areas, paired with its own masked shimmer pattern.
 */
export const LoadingArea = ({
  chartId,
  curveType,
}: {
  chartId: string;
  curveType: ComponentProps<typeof RechartsArea>["type"];
}) => (
  <>
    <RechartsArea
      activeDot={false}
      dataKey={"loading"}
      dot={false}
      fill="currentColor"
      fillOpacity={0.05}
      isAnimationActive={false}
      legendType="none"
      stroke="currentColor"
      strokeOpacity={0.5}
      style={{ mask: `url(#${chartId}-loading-mask)` }}
      tooltipType="none"
      type={curveType}
    />
    <defs>
      <LoadingShimmer chartId={chartId} />
    </defs>
  </>
);

/**
 * The skeleton line shown while the chart is loading. Rendered by the root in
 * place of the real lines, paired with its own masked shimmer pattern.
 */
export const LoadingLine = ({
  chartId,
  curveType,
  strokeWidth,
}: {
  chartId: string;
  curveType: ComponentProps<typeof RechartsLine>["type"];
  strokeWidth: number;
}) => (
  <>
    <RechartsLine
      activeDot={false}
      dataKey={"loading"}
      dot={false}
      isAnimationActive={false}
      legendType="none"
      max={100}
      min={0}
      stroke="currentColor"
      strokeOpacity={0.5}
      strokeWidth={strokeWidth}
      style={{ mask: `url(#${chartId}-loading-mask)` }}
      tooltipType="none"
      type={curveType}
    />
    <defs>
      <LoadingShimmer chartId={chartId} />
    </defs>
  </>
);

/**
 * The skeleton bar shown while the chart is loading. Rendered by the root in
 * place of the real bars and lines, paired with its own masked shimmer pattern.
 */
export const LoadingBar = ({
  chartId,
  barRadius,
}: {
  chartId: string;
  barRadius: number;
}) => (
  <>
    <RechartsBar
      dataKey={"loading"}
      fill="currentColor"
      fillOpacity={0.15}
      isAnimationActive={false}
      legendType="none"
      radius={barRadius}
      style={{ mask: `url(#${chartId}-loading-mask)` }}
    />
    <defs>
      <LoadingShimmer chartId={chartId} />
    </defs>
  </>
);
