"use client";

import {
  type ChartConfig,
  getChartColorVariable,
  getChartSeriesId,
  getChartSeriesPaint,
  getColorsCount,
} from "@repo/design-system/components/evilcharts/ui/chart-config";
import { ChartStyle } from "@repo/design-system/components/evilcharts/ui/chart-style";
import { cn } from "@repo/design-system/lib/utils";
import type { MotionValue } from "motion/react";
import {
  m,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
} from "motion/react";
import * as React from "react";
import { type ComponentProps, useCallback } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────────────────

type EvilBrushVariant = "line" | "area" | "bar";
type CurveType = ComponentProps<typeof Area>["type"];

interface EvilBrushRange {
  endIndex: number;
  startIndex: number;
}

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
  curveType?: CurveType;
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

// ─── Spring config ──────────────────────────────────────────────────────────

const SPRING_CONFIG = { stiffness: 300, damping: 35, mass: 0.8 };

// ─── Pointer-capture drag hook ──────────────────────────────────────────────
// Replaces raw addEventListener with the modern Pointer Events API.
// setPointerCapture routes all pointer events to the originating element,
// so we get mouse + touch + pen support with zero global listeners.

type DragType = "left" | "right" | "middle";

interface DragState {
  originRange: EvilBrushRange;
  originX: number;
  type: DragType;
}

function rangesEqual(current: EvilBrushRange, next: EvilBrushRange) {
  return (
    current.startIndex === next.startIndex && current.endIndex === next.endIndex
  );
}

function clampRangeToData(range: EvilBrushRange, dataLength: number) {
  const maxIndex = Math.max(0, dataLength - 1);
  const startIndex = Math.max(0, Math.min(range.startIndex, maxIndex));
  const endIndex = Math.max(startIndex, Math.min(range.endIndex, maxIndex));

  return { startIndex, endIndex };
}

function useBrushDrag({
  range,
  totalPoints,
  containerRef,
  commit,
}: {
  range: EvilBrushRange;
  totalPoints: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  commit: (next: EvilBrushRange, mode?: DragType) => void;
}) {
  const dragRef = React.useRef<DragState | null>(null);

  const toIndexDelta = useCallback(
    (px: number) => {
      if (!containerRef.current || totalPoints <= 1) {
        return 0;
      }
      return Math.round(
        (px / containerRef.current.getBoundingClientRect().width) *
          (totalPoints - 1)
      );
    },
    [totalPoints, containerRef]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent, type: DragType) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = { type, originX: e.clientX, originRange: { ...range } };
    },
    [range]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current;
      if (!d) {
        return;
      }

      const delta = toIndexDelta(e.clientX - d.originX);
      const { type, originRange: o } = d;

      if (type === "left") {
        commit(
          { startIndex: o.startIndex + delta, endIndex: o.endIndex },
          "left"
        );
      } else if (type === "right") {
        commit(
          { startIndex: o.startIndex, endIndex: o.endIndex + delta },
          "right"
        );
      } else {
        const span = o.endIndex - o.startIndex;
        let s = o.startIndex + delta;
        let e2 = s + span;
        if (s < 0) {
          s = 0;
          e2 = span;
        }
        if (e2 > totalPoints - 1) {
          e2 = totalPoints - 1;
          s = Math.max(0, e2 - span);
        }
        commit({ startIndex: s, endIndex: e2 }, "middle");
      }
    },
    [toIndexDelta, totalPoints, commit]
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    dragRef.current = null;
  }, []);

  // Helper to bind all three pointer handlers for a given drag type
  const bind = useCallback(
    (type: DragType) => ({
      onPointerDown: (e: React.PointerEvent) => onPointerDown(e, type),
      onPointerMove,
      onPointerUp,
    }),
    [onPointerDown, onPointerMove, onPointerUp]
  );

  return { bind };
}

// ─── EvilBrush ────────────────────────────────────────────────────────────

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

  // ── Controlled vs uncontrolled ──────────────────────────────────────────

  const isControlled =
    controlledStart !== undefined && controlledEnd !== undefined;

  // ── Clamping & committing ───────────────────────────────────────────────

  const clampRange = useCallback(
    (range: EvilBrushRange, mode?: DragType): EvilBrushRange => {
      let { startIndex, endIndex } = range;
      const maxIndex = Math.max(0, totalPoints - 1);

      startIndex = Math.max(0, Math.min(startIndex, maxIndex));
      endIndex = Math.max(0, Math.min(endIndex, maxIndex));

      if (mode === "left") {
        const maxStart = Math.max(0, endIndex - minSpan);
        startIndex = Math.min(startIndex, maxStart);
        return { startIndex, endIndex };
      }

      if (mode === "right") {
        const minEnd = Math.min(maxIndex, startIndex + minSpan);
        endIndex = Math.max(endIndex, minEnd);
        return { startIndex, endIndex };
      }

      if (endIndex - startIndex < minSpan) {
        endIndex = Math.min(startIndex + minSpan, maxIndex);
        if (endIndex - startIndex < minSpan) {
          startIndex = Math.max(0, endIndex - minSpan);
        }
      }
      return { startIndex, endIndex };
    },
    [totalPoints, minSpan]
  );

  const [internalRange, setInternalRange] = React.useState<EvilBrushRange>(() =>
    clampRange({
      startIndex: defaultStartIndex,
      endIndex: defaultEndIndex ?? totalPoints - 1,
    })
  );

  const range = clampRange(
    isControlled
      ? { startIndex: controlledStart, endIndex: controlledEnd }
      : internalRange
  );

  const lastCommittedRef = React.useRef<EvilBrushRange>(range);

  if (!rangesEqual(lastCommittedRef.current, range)) {
    lastCommittedRef.current = range;
  }

  const commit = useCallback(
    (next: EvilBrushRange, mode?: DragType) => {
      const clamped = clampRange(next, mode);
      const last = lastCommittedRef.current;

      // Only update if the range has actually changed — avoids unnecessary
      // re-renders when the brush is at a boundary and small mouse movements
      // don't produce index changes
      if (
        last.startIndex === clamped.startIndex &&
        last.endIndex === clamped.endIndex
      ) {
        return;
      }

      lastCommittedRef.current = clamped;
      if (!isControlled) {
        setInternalRange(clamped);
      }
      // Defer the parent callback — chart re-render happens at lower priority,
      // React can skip intermediate frames during fast drags
      React.startTransition(() => {
        onChange?.(clamped);
      });
    },
    [clampRange, isControlled, onChange]
  );

  // ── Drag ────────────────────────────────────────────────────────────────

  const { bind } = useBrushDrag({
    range,
    totalPoints,
    containerRef,
    commit,
  });

  // ── Computed positions (%) ──────────────────────────────────────────────

  const leftPct =
    totalPoints > 1 ? (range.startIndex / (totalPoints - 1)) * 100 : 0;
  const rightPct =
    totalPoints > 1 ? (range.endIndex / (totalPoints - 1)) * 100 : 100;

  // Drive all moving brush UI from the same springed edge values.
  const leftTarget = useMotionValue(leftPct);
  const rightTarget = useMotionValue(rightPct);
  if (leftTarget.get() !== leftPct) {
    leftTarget.set(leftPct);
  }
  if (rightTarget.get() !== rightPct) {
    rightTarget.set(rightPct);
  }

  const leftSpring = useSpring(leftTarget, SPRING_CONFIG);
  const rightSpring = useSpring(rightTarget, SPRING_CONFIG);
  const leftPosition = useTransform(leftSpring, (v) => `${v}%`);
  const rightPosition = useTransform(rightSpring, (v) => `${v}%`);
  const leftOverlayWidth = useTransform(leftSpring, (v) => `${v}%`);
  const rightOverlayWidth = useTransform(
    rightSpring,
    (v) => `${Math.max(0, 100 - v)}%`
  );
  const selectedWidth = useMotionValue(`${Math.max(0, rightPct - leftPct)}%`);

  const updateSelectedWidth = useCallback(() => {
    selectedWidth.set(`${Math.max(0, rightSpring.get() - leftSpring.get())}%`);
  }, [leftSpring, rightSpring, selectedWidth]);

  useMotionValueEvent(leftSpring, "change", updateSelectedWidth);
  useMotionValueEvent(rightSpring, "change", updateSelectedWidth);

  const getLabel = useCallback(
    (idx: number) => {
      if (!xDataKey) {
        return String(idx);
      }
      const v = data[idx]?.[xDataKey];
      return formatLabel ? formatLabel(v, idx) : String(v ?? idx);
    },
    [data, xDataKey, formatLabel]
  );

  // ── Render ──────────────────────────────────────────────────────────────

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
        <MiniChart
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
      </div>

      {/* Dim overlay – left */}
      <m.div
        className="pointer-events-none absolute inset-y-0 left-0 rounded-l-md bg-background/70 backdrop-blur-[2px]"
        style={{ width: leftOverlayWidth }}
      />
      {/* Dim overlay – right */}
      <m.div
        className="pointer-events-none absolute inset-y-0 right-0 rounded-r-md bg-background/70 backdrop-blur-[2px]"
        style={{ width: rightOverlayWidth }}
      />

      {/* Selected region – draggable to pan */}
      <m.div
        className="absolute inset-y-0 cursor-grab touch-none rounded-sm border active:cursor-grabbing"
        style={{ left: leftPosition, width: selectedWidth }}
        {...bind("middle")}
      />

      {/* Left handle */}
      <BrushHandle
        bind={bind("left")}
        label={showLabels ? getLabel(range.startIndex) : undefined}
        position={leftPosition}
        side="left"
      />

      {/* Right handle */}
      <BrushHandle
        bind={bind("right")}
        label={showLabels ? getLabel(range.endIndex) : undefined}
        position={rightPosition}
        side="right"
      />
    </div>
  );
}

// ─── Brush Handle ───────────────────────────────────────────────────────────

function BrushHandle({
  side,
  position,
  label,
  bind,
}: {
  side: "left" | "right";
  position: MotionValue<string>;
  label?: string;
  bind: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
  };
}) {
  const isLeft = side === "left";

  return (
    <m.div className="absolute inset-y-0 z-10" style={{ left: position }}>
      <div
        className={cn(
          "group absolute inset-y-0 flex w-3 cursor-ew-resize touch-none items-center justify-center after:absolute after:inset-y-0 after:-left-4 after:w-11 after:content-['']",
          isLeft ? "" : "-translate-x-full"
        )}
        {...bind}
      >
        <div
          className={cn(
            "relative flex h-4 w-1.5 items-center justify-center rounded-md bg-muted-foreground transition-colors group-hover:bg-foreground",
            isLeft ? "-left-[5.5px]" : "-right-[5.5px]"
          )}
        >
          <div className="flex flex-col gap-[2px]">
            <div className="h-[2px] w-[2px] rounded-full bg-background/70" />
            <div className="h-[2px] w-[2px] rounded-full bg-background/70" />
            <div className="h-[2px] w-[2px] rounded-full bg-background/70" />
          </div>
        </div>
      </div>

      {label && (
        <div
          className={cn(
            "pointer-events-none absolute -bottom-3 -translate-y-1/2 whitespace-nowrap rounded-[3px] bg-foreground px-1 py-px font-medium text-[8px] text-background leading-tight opacity-0 group-hover:opacity-100",
            isLeft ? "left-1.5" : "right-1.5"
          )}
        >
          {label}
        </div>
      )}
    </m.div>
  );
}

// ─── Mini Chart ─────────────────────────────────────────────────────────────

function MiniChart({
  data,
  keys,
  chartConfig,
  variant,
  curveType,
  chartId,
  stacked,
  strokeVariant = "solid",
  connectNulls = false,
  barRadius,
}: {
  data: Record<string, unknown>[];
  keys: string[];
  chartConfig: ChartConfig;
  variant: EvilBrushVariant;
  curveType: CurveType;
  chartId: string;
  stacked: boolean;
  strokeVariant?: "solid" | "dashed" | "animated-dashed";
  connectNulls?: boolean;
  barRadius?: number;
}) {
  const gradients = React.useMemo(
    () =>
      Object.entries(chartConfig).flatMap(([dataKey, config]) => {
        if (!keys.includes(dataKey)) {
          return [];
        }

        return [
          {
            colorsCount: getColorsCount(config),
            dataKey,
          },
        ];
      }),
    [chartConfig, keys]
  );

  const dashArray =
    strokeVariant === "dashed" || strokeVariant === "animated-dashed"
      ? "4 4"
      : undefined;

  const defsContent = (
    <>
      {/* Vertical fade gradient for area fill mask */}
      {variant === "area" && (
        <linearGradient
          id={`${chartId}-zm-vertical-fade`}
          x1="0"
          x2="0"
          y1="0"
          y2="1"
        >
          <stop offset="0%" stopColor="white" stopOpacity={0.15} />
          <stop offset="100%" stopColor="white" stopOpacity={0} />
        </linearGradient>
      )}
      {gradients.map(({ dataKey, colorsCount }) => {
        const colorStops =
          colorsCount === 1 ? (
            <>
              <stop offset="0%" stopColor={getChartColorVariable(dataKey, 0)} />
              <stop
                offset="100%"
                stopColor={getChartColorVariable(dataKey, 0)}
              />
            </>
          ) : (
            Array.from({ length: colorsCount }, (_, i) => {
              const offset = `${(i / (colorsCount - 1)) * 100}%`;

              return (
                <stop
                  key={`${dataKey}-${offset}`}
                  offset={offset}
                  stopColor={getChartColorVariable(dataKey, i, 0)}
                />
              );
            })
          );

        return (
          <React.Fragment key={dataKey}>
            {/* Vertical color gradient (stroke + bar fill) */}
            <linearGradient
              id={getChartSeriesId(chartId, "zm", dataKey)}
              x1="0"
              x2="0"
              y1="0"
              y2="1"
            >
              {colorStops}
            </linearGradient>

            {/* Area fill: color gradient masked with vertical fade */}
            {variant === "area" && (
              <>
                <mask id={getChartSeriesId(chartId, "zm-fill-mask", dataKey)}>
                  <rect
                    fill={`url(#${chartId}-zm-vertical-fade)`}
                    height="100%"
                    width="100%"
                  />
                </mask>
                <pattern
                  height="100%"
                  id={getChartSeriesId(chartId, "zm-fill", dataKey)}
                  patternUnits="userSpaceOnUse"
                  width="100%"
                >
                  <rect
                    fill={`url(#${getChartSeriesId(chartId, "zm", dataKey)})`}
                    height="100%"
                    mask={`url(#${getChartSeriesId(chartId, "zm-fill-mask", dataKey)})`}
                    width="100%"
                  />
                </pattern>
              </>
            )}
          </React.Fragment>
        );
      })}
    </>
  );

  if (variant === "line") {
    return (
      <ResponsiveContainer height="100%" width="100%">
        <LineChart
          data={data}
          margin={{ top: 4, right: 0, bottom: 0, left: 0 }}
        >
          <defs>{defsContent}</defs>
          {keys.map((dk) => (
            <Line
              activeDot={false}
              connectNulls={connectNulls}
              dataKey={dk}
              dot={false}
              isAnimationActive={false}
              key={dk}
              stroke={getChartSeriesPaint(
                chartId,
                "zm",
                dk,
                getColorsCount(chartConfig[dk] ?? {})
              )}
              strokeDasharray={dashArray}
              strokeOpacity={0.5}
              strokeWidth={1}
              type={curveType}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (variant === "bar") {
    const r = barRadius ?? 3;
    return (
      <ResponsiveContainer height="100%" width="100%">
        <BarChart
          barGap={2}
          barSize={14}
          data={data}
          margin={{ top: 2, right: 0, bottom: 0, left: 0 }}
        >
          <defs>{defsContent}</defs>
          {keys.map((dk) => (
            <Bar
              dataKey={dk}
              fill={`url(#${getChartSeriesId(chartId, "zm", dk)})`}
              fillOpacity={0.35}
              isAnimationActive={false}
              key={dk}
              radius={[r, r, r, r]}
              stackId={stacked ? "zm-stack" : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // Default: area
  return (
    <ResponsiveContainer height="100%" width="100%">
      <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>{defsContent}</defs>
        {keys.map((dk) => (
          <Area
            activeDot={false}
            connectNulls={connectNulls}
            dataKey={dk}
            dot={false}
            fill={`url(#${getChartSeriesId(chartId, "zm-fill", dk)})`}
            fillOpacity={1}
            isAnimationActive={false}
            key={dk}
            stackId={stacked ? "zm-stack" : undefined}
            stroke={getChartSeriesPaint(
              chartId,
              "zm",
              dk,
              getColorsCount(chartConfig[dk] ?? {})
            )}
            strokeDasharray={dashArray}
            strokeOpacity={0.5}
            strokeWidth={1}
            type={curveType}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── useEvilBrush Hook ──────────────────────────────────────────────────────

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
