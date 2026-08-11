import { useChart } from "@repo/design-system/components/evilcharts/ui/chart";
import { getChartPayloadStringValue } from "@repo/design-system/components/evilcharts/ui/chart-payload";
import {
  type TooltipIndicator,
  TooltipItem,
  TooltipLabel,
  type TooltipLabelProps,
} from "@repo/design-system/components/evilcharts/ui/tooltip-item";
import { cn } from "@repo/design-system/lib/utils";
import type * as React from "react";
import * as RechartsPrimitive from "recharts";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";

export type TooltipRoundness = "sm" | "md" | "lg" | "xl";
export type TooltipVariant = "default" | "frosted-glass";

type TooltipPayloadItem = NonNullable<
  RechartsPrimitive.DefaultTooltipContentProps<ValueType, NameType>["payload"]
>[number];

/** Resolves the stable React key for one tooltip payload item. */
function getTooltipItemKey(item: TooltipPayloadItem, nameKey?: string) {
  const payloadName = getChartPayloadStringValue(item.payload, nameKey);
  const key = `${payloadName ?? item.name ?? item.dataKey ?? "value"}`;
  return `${key}-${String(item.dataKey ?? item.name ?? item.value)}`;
}

const roundnessMap: Record<TooltipRoundness, string> = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
};

const variantMap: Record<TooltipVariant, string> = {
  default: "bg-background",
  "frosted-glass": "bg-background/70 backdrop-blur-sm",
};

function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = "dot",
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  labelClassName,
  formatter,
  nameKey,
  labelKey,
  selected,
  roundness = "lg",
  variant = "default",
}: React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
  React.ComponentProps<"div"> & {
    hideLabel?: boolean;
    hideIndicator?: boolean;
    indicator?: TooltipIndicator;
    nameKey?: string;
    labelKey?: string;
    selected?: string | null;
    roundness?: TooltipRoundness;
    variant?: TooltipVariant;
  } & Omit<
    RechartsPrimitive.DefaultTooltipContentProps<ValueType, NameType>,
    "accessibilityLayer"
  >) {
  const { config } = useChart();

  if (!(active && payload?.length)) {
    // Empty tooltip - to prevent position getting 0.0 so it doesnt animate tooltip every time from 0.0 origin
    return <span className="p-4" />;
  }

  const nestLabel = payload.length === 1 && indicator !== "dot";
  const labelProps: TooltipLabelProps = {
    config,
    hideLabel,
    label,
    labelClassName,
    labelFormatter,
    labelKey,
    payload,
  };

  return (
    <div
      className={cn(
        "grid min-w-32 items-start gap-1.5 border border-border/50 px-2.5 py-1.5 text-xs shadow-xl",
        roundnessMap[roundness],
        variantMap[variant],
        className
      )}
    >
      {nestLabel ? null : <TooltipLabel {...labelProps} />}
      <div className="grid gap-1.5">
        {payload.map((item, index) => {
          if (item.type === "none") {
            return null;
          }

          return (
            <TooltipItem
              config={config}
              formatter={formatter}
              hideIndicator={hideIndicator}
              index={index}
              indicator={indicator}
              item={item}
              key={getTooltipItemKey(item, nameKey)}
              labelProps={labelProps}
              nameKey={nameKey}
              nestLabel={nestLabel}
              selected={selected}
            />
          );
        })}
      </div>
    </div>
  );
}

function ChartTooltip({
  animationDuration = 200,
  ...props
}: React.ComponentProps<typeof RechartsPrimitive.Tooltip>) {
  return (
    <RechartsPrimitive.Tooltip
      animationDuration={animationDuration}
      {...props}
    />
  );
}

export { ChartTooltip, ChartTooltipContent };
