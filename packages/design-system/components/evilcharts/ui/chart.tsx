"use client";

import type { EvilBrushCurveType } from "@repo/design-system/components/evilcharts/ui/brush-preview";
import {
  type AtLeastOneThemeColor,
  type ChartConfig,
  validateChartConfigColors,
} from "@repo/design-system/components/evilcharts/ui/chart-config";
import { ChartStyle } from "@repo/design-system/components/evilcharts/ui/chart-style";
import type { EvilBrushVariant } from "@repo/design-system/components/evilcharts/ui/evil-brush";
import type { ChartSeriesCue } from "@repo/design-system/lib/charts/series-cue";
import { cn } from "cn";
import { Result } from "effect";
import { domAnimation, LazyMotion } from "motion/react";
import {
  type ComponentProps,
  type ComponentType,
  createContext,
  type ReactNode,
  use,
  useId,
  useMemo,
} from "react";
import { ResponsiveContainer } from "recharts";

/** Options of the zoom brush, set once by the chart root and read by the brush parts. */
export interface ChartBrushOptions {
  barRadius?: number | undefined; // corner radius of the bars in the miniature chart
  curveType?: EvilBrushCurveType | undefined; // curve of the miniature line or area
  formatLabel?: ((value: unknown, index: number) => string) | undefined; // formats the handle labels
  height?: number | undefined; // pixel height of the brush
  stacked?: boolean | undefined; // whether the miniature series stack on each other
  variant?: EvilBrushVariant | undefined; // visual variant of the miniature chart
  xDataKey?: string | undefined; // x-axis key whose values label the handles
}

interface ChartContextProps {
  brush: ChartBrushOptions;
  config: ChartConfig;
}

const ChartContext = createContext<ChartContextProps | null>(null);

export function useChart<T>(selector: (chart: ChartContextProps) => T) {
  const value = use(ChartContext);

  if (!value) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }

  return selector(value);
}

export interface ChartContainerProps
  extends Omit<ComponentProps<"div">, "children">,
    Pick<
      ComponentProps<typeof ResponsiveContainer>,
      | "initialDimension"
      | "aspect"
      | "debounce"
      | "minHeight"
      | "minWidth"
      | "maxHeight"
      | "height"
      | "width"
      | "onResize"
      | "children"
    > {
  brush: ChartBrushOptions;
  config: Record<
    string,
    {
      cue?: ChartSeriesCue;
      label?: ReactNode;
      icon?: ComponentType;
      colors?: AtLeastOneThemeColor;
    }
  >;
  /** Optional content rendered below the chart (e.g. EvilBrush) */
  footer?: ReactNode;
  innerResponsiveContainerStyle?: ComponentProps<
    typeof ResponsiveContainer
  >["style"];
}

function ChartContainer({
  id,
  brush,
  config,
  initialDimension = { width: 320, height: 200 },
  className,
  children,
  footer,
  ...props
}: Readonly<ChartContainerProps>) {
  const uniqueId = useId();
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`;
  const contextValue = useMemo(() => ({ brush, config }), [brush, config]);
  Result.getOrThrow(validateChartConfigColors(config));

  return (
    <LazyMotion features={domAnimation} strict>
      <ChartContext value={contextValue}>
        <div
          className={cn(
            "min-h-0 w-full flex-1",
            "relative flex flex-col justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-hidden [&_.recharts-surface]:outline-hidden",
            !footer && "aspect-video",
            className
          )}
          data-chart={chartId}
          data-slot="chart"
          {...props}
        >
          <ChartStyle config={config} id={chartId} />
          <ResponsiveContainer
            className="min-h-0 w-full flex-1"
            initialDimension={initialDimension}
          >
            {children}
          </ResponsiveContainer>
          {footer}
        </div>
      </ChartContext>
    </LazyMotion>
  );
}

export { ChartContainer };
