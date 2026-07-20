"use client";

import type { ChartConfig } from "@repo/design-system/components/evilcharts/ui/chart-config";
import { ChartStyle } from "@repo/design-system/components/evilcharts/ui/chart-style";
import { EvilBrushControls } from "@repo/design-system/components/evilcharts/ui/evil-brush-controls";
import {
  type EvilBrushCurveType,
  EvilBrushPreview,
} from "@repo/design-system/components/evilcharts/ui/evil-brush-preview";
import { useBrushSelection } from "@repo/design-system/components/evilcharts/ui/evil-brush-selection";
import { cn } from "@repo/design-system/lib/utils";
import * as React from "react";

// ─── Types ──────────────────────────────────────────────────────────────────

/** Miniature chart style rendered behind the range controls. */
type EvilBrushVariant = "line" | "area" | "bar";

/** Inclusive indexes selected by an EvilCharts brush. */
interface EvilBrushRange {
  endIndex: number;
  startIndex: number;
}

/**
 * Configuration for a standalone or chart-owned EvilCharts range selector.
 * Supplying both indexes makes the range controlled; otherwise defaults seed
 * the component's local range.
 */
interface EvilBrushProps {
  /** Radius for bar corners in the bar variant */
  barRadius?: number;
  /** Chart config with colour definitions */
  chartConfig: ChartConfig;
  /** Extra className */
  className?: string;
  /** Whether to connect null data points in line / area variants */
  connectNulls?: boolean;
  /** Curve type for line / area variants */
  curveType?: EvilBrushCurveType;
  /** Full dataset – always rendered in the miniature chart */
  data: Record<string, unknown>[];
  /** Data keys to plot (default: all keys from chartConfig) */
  dataKeys?: string[];
  /** Initial end index (uncontrolled) */
  defaultEndIndex?: number;

  // ── Uncontrolled mode ────────────────────────────────────────────────
  /** Initial start index (uncontrolled) */
  defaultStartIndex?: number;
  /** Controlled end index */
  endIndex?: number;
  /** Format the handle label from the xDataKey value */
  formatLabel?: (value: unknown, index: number) => string;
  /** Pixel height of the brush */
  height?: number;
  /** Minimum number of data points that must remain selected */
  minSpan?: number;

  /** Fired whenever the visible range changes */
  onChange?: (range: EvilBrushRange) => void;
  /** Whether to render labels on the handles */
  showLabels?: boolean;
  /** Skip rendering own ChartStyle (when inside a ChartContainer that already provides CSS vars) */
  skipStyle?: boolean;
  /** Whether areas/bars should be stacked in the mini chart */
  stacked?: boolean;

  // ── Controlled mode ──────────────────────────────────────────────────
  /** Controlled start index */
  startIndex?: number;
  /** Stroke variant for line / area strokes in the mini chart */
  strokeVariant?: "solid" | "dashed" | "animated-dashed";
  /** Visual variant of the mini chart */
  variant?: EvilBrushVariant;
  /** X-axis data key – used for handle labels */
  xDataKey?: string;
}

/** Restricts a stored range to the indexes available in the current dataset. */
function clampRangeToData(range: EvilBrushRange, dataLength: number) {
  const maxIndex = Math.max(0, dataLength - 1);
  const startIndex = Math.max(0, Math.min(range.startIndex, maxIndex));
  const endIndex = Math.max(startIndex, Math.min(range.endIndex, maxIndex));

  return { startIndex, endIndex };
}

// ─── EvilBrush ────────────────────────────────────────────────────────────

/**
 * Renders an animated range selector over a miniature chart. The component can
 * own its range or receive both indexes from a controlling chart.
 */
function EvilBrush({
  data,
  chartConfig,
  dataKeys,
  xDataKey,
  variant = "area",
  height = 56,
  className,
  stacked = false,
  strokeVariant = "solid",
  connectNulls = false,
  barRadius,
  startIndex: controlledStart,
  endIndex: controlledEnd,
  defaultStartIndex = 0,
  defaultEndIndex,
  onChange,
  formatLabel,
  curveType = "monotone",
  minSpan = 2,
  showLabels = true,
  skipStyle = false,
}: EvilBrushProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const keys = React.useMemo(
    () => dataKeys ?? Object.keys(chartConfig),
    [dataKeys, chartConfig]
  );
  const totalPoints = data.length;
  const chartId = React.useId().replace(/:/g, "");

  const { bind, range } = useBrushSelection({
    containerRef,
    controlledEnd,
    controlledStart,
    defaultEndIndex,
    defaultStartIndex,
    minSpan,
    onChange,
    totalPoints,
  });
  const rangeStartIndex = range.startIndex;
  const rangeEndIndex = range.endIndex;

  if (totalPoints === 0) {
    return null;
  }

  return (
    <div
      className={cn("group relative select-none", className)}
      data-chart={skipStyle ? undefined : chartId}
      ref={containerRef}
      style={{ height }}
    >
      {!skipStyle && <ChartStyle config={chartConfig} id={chartId} />}

      {/* Mini chart – always shows all data */}
      <div className="absolute inset-0 overflow-hidden rounded-md">
        <React.Suspense fallback={null}>
          <EvilBrushPreview
            barRadius={barRadius}
            chartConfig={chartConfig}
            chartId={chartId}
            connectNulls={connectNulls}
            curveType={curveType}
            data={data}
            keys={keys}
            stacked={stacked}
            strokeVariant={
              strokeVariant === "animated-dashed" ? "dashed" : strokeVariant
            }
            variant={variant}
          />
        </React.Suspense>
      </div>

      <EvilBrushControls
        bind={bind}
        data={data}
        formatLabel={formatLabel}
        rangeEndIndex={rangeEndIndex}
        rangeStartIndex={rangeStartIndex}
        showLabels={showLabels}
        totalPoints={totalPoints}
        xDataKey={xDataKey}
      />
    </div>
  );
}

// ─── useEvilBrush Hook ──────────────────────────────────────────────────────

/** Owns a chart range and returns deferred visible data with brush bindings. */
function useEvilBrush<TData extends Record<string, unknown>>({
  data,
  defaultStartIndex = 0,
  defaultEndIndex,
}: {
  data: TData[];
  defaultStartIndex?: number;
  defaultEndIndex?: number;
}) {
  const [range, setRange] = React.useState<EvilBrushRange>({
    startIndex: defaultStartIndex,
    endIndex: defaultEndIndex ?? Math.max(0, data.length - 1),
  });
  const clampedRange = React.useMemo(
    () => clampRangeToData(range, data.length),
    [range, data.length]
  );

  // Defer the range used for data slicing — the brush handles move at the
  // immediate `range` cadence while the expensive chart re-render uses the
  // deferred value.  React can skip intermediate slices during fast drags.
  const deferredRange = React.useDeferredValue(clampedRange);

  const visibleData = React.useMemo(
    () => data.slice(deferredRange.startIndex, deferredRange.endIndex + 1),
    [data, deferredRange.startIndex, deferredRange.endIndex]
  );

  return {
    range: clampedRange,
    visibleData,
    brushProps: {
      startIndex: clampedRange.startIndex,
      endIndex: clampedRange.endIndex,
      onChange: setRange,
    } satisfies Pick<EvilBrushProps, "startIndex" | "endIndex" | "onChange">,
  };
}

export {
  EvilBrush,
  type EvilBrushProps,
  type EvilBrushRange,
  type EvilBrushVariant,
  useEvilBrush,
};
