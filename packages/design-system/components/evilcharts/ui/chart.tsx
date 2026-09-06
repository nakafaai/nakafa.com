"use client";

import {
  type ChartConfig,
  validateChartConfigColors,
} from "@repo/design-system/components/evilcharts/ui/chart-config";
import { ChartStyle } from "@repo/design-system/components/evilcharts/ui/chart-style";
import { cn } from "@repo/design-system/lib/utils";
import { domAnimation, LazyMotion } from "motion/react";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  use,
  useId,
  useMemo,
} from "react";
import { ResponsiveContainer } from "recharts";

interface ChartContextProps {
  config: ChartConfig;
}

const ChartContext = createContext<ChartContextProps | null>(null);

export function useChart() {
  const context = use(ChartContext);

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }

  return context;
}

interface ChartContainerProps
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
  config: ChartConfig;
  /** Optional content rendered below the chart (e.g. EvilBrush) */
  footer?: ReactNode;
  innerResponsiveContainerStyle?: ComponentProps<
    typeof ResponsiveContainer
  >["style"];
}

function ChartContainer({
  id,
  config,
  initialDimension = { width: 320, height: 200 },
  className,
  children,
  footer,
  ...props
}: Readonly<ChartContainerProps>) {
  const uniqueId = useId();
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`;
  const contextValue = useMemo(() => ({ config }), [config]);

  validateChartConfigColors(config);

  return (
    <LazyMotion features={domAnimation} strict>
      <ChartContext.Provider value={contextValue}>
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
      </ChartContext.Provider>
    </LazyMotion>
  );
}

export { ChartContainer };
