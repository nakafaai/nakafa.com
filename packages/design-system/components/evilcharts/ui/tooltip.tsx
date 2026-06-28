import { useChart } from "@repo/design-system/components/evilcharts/ui/chart";
import {
  type ChartConfig,
  getChartColorVariable,
  getColorsCount,
  getPayloadConfigEntry,
} from "@repo/design-system/components/evilcharts/ui/chart-config";
import { getChartPayloadStringValue } from "@repo/design-system/components/evilcharts/ui/chart-payload";
import { cn } from "@repo/design-system/lib/utils";
import type * as React from "react";
import * as RechartsPrimitive from "recharts";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";

export type TooltipRoundness = "sm" | "md" | "lg" | "xl";
export type TooltipVariant = "default" | "frosted-glass";

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
    indicator?: "line" | "dot" | "dashed";
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
  const tooltipLabel = getTooltipLabel({
    config,
    hideLabel,
    label,
    labelClassName,
    labelFormatter,
    labelKey,
    payload,
  });

  const items = payload.flatMap((item, index) => {
    if (item.type === "none") {
      return [];
    }

    // For pie charts, item.name contains the sector name (e.g., "chrome")
    // For radial charts, the name is in item.payload[nameKey]
    // For other charts, item.name or item.dataKey contains the series name
    const payloadName = getChartPayloadStringValue(item.payload, nameKey);
    const key = `${payloadName ?? item.name ?? item.dataKey ?? "value"}`;
    const configEntry = getPayloadConfigEntry(config, item, key);
    const itemConfig = configEntry?.config;
    const dataKey = configEntry?.dataKey ?? key;
    const payloadFill = getChartPayloadStringValue(item.payload, "fill");
    const colorsCount = itemConfig ? getColorsCount(itemConfig) : 1;

    return [
      <div
        className={cn(
          "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
          indicator === "dot" && "items-center",
          selected != null && selected !== item.dataKey && "opacity-30"
        )}
        key={`${key}-${String(item.dataKey ?? item.name ?? item.value)}`}
      >
        {formatter && item?.value !== undefined && item.name ? (
          formatter(item.value, item.name, item, index, item.payload)
        ) : (
          <>
            {itemConfig?.icon ? (
              <itemConfig.icon />
            ) : (
              !hideIndicator && (
                <div
                  className={cn("shrink-0 rounded-[2px]", {
                    "h-2.5 w-2.5": indicator === "dot",
                    "w-1": indicator === "line",
                    "w-0 border-[1.5px] border-dashed bg-transparent!":
                      indicator === "dashed",
                    "my-0.5": nestLabel && indicator === "dashed",
                  })}
                  style={getIndicatorColorStyle(
                    dataKey,
                    colorsCount,
                    payloadFill
                  )}
                />
              )
            )}
            <div
              className={cn(
                "flex flex-1 justify-between gap-4 leading-none",
                nestLabel ? "items-end" : "items-center"
              )}
            >
              <div className="grid gap-1.5">
                {nestLabel ? tooltipLabel : null}
                <span className="text-muted-foreground">
                  {itemConfig?.label ?? item.name}
                </span>
              </div>
              {item.value != null && (
                <span className="font-medium font-mono text-foreground tabular-nums">
                  {typeof item.value === "number"
                    ? item.value.toLocaleString()
                    : String(item.value)}
                </span>
              )}
            </div>
          </>
        )}
      </div>,
    ];
  });

  return (
    <div
      className={cn(
        "grid min-w-32 items-start gap-1.5 border border-border/50 px-2.5 py-1.5 text-xs shadow-xl",
        roundnessMap[roundness],
        variantMap[variant],
        className
      )}
    >
      {nestLabel ? null : tooltipLabel}
      <div className="grid gap-1.5">{items}</div>
    </div>
  );
}

function getTooltipLabel({
  config,
  hideLabel,
  label,
  labelClassName,
  labelFormatter,
  labelKey,
  payload,
}: {
  config: ChartConfig;
  hideLabel: boolean;
  label?: React.ReactNode;
  labelClassName?: string;
  labelFormatter?: RechartsPrimitive.DefaultTooltipContentProps<
    ValueType,
    NameType
  >["labelFormatter"];
  labelKey?: string;
  payload: NonNullable<
    RechartsPrimitive.DefaultTooltipContentProps<ValueType, NameType>["payload"]
  >;
}) {
  if (hideLabel) {
    return null;
  }

  const [item] = payload;
  const key = `${labelKey ?? item?.dataKey ?? item?.name ?? "value"}`;
  const configEntry = getPayloadConfigEntry(config, item, key);
  const itemConfig = configEntry?.config;
  const value =
    !labelKey && typeof label === "string"
      ? (config[label]?.label ?? label)
      : itemConfig?.label;

  if (labelFormatter) {
    return (
      <div className={cn("font-medium", labelClassName)}>
        {labelFormatter(value, payload)}
      </div>
    );
  }

  if (!value) {
    return null;
  }

  return <div className={cn("font-medium", labelClassName)}>{value}</div>;
}

function getIndicatorColorStyle(
  dataKey: string,
  colorsCount: number,
  fill?: string
): React.CSSProperties {
  if (fill) {
    return { background: fill };
  }

  if (colorsCount <= 1) {
    return { background: getChartColorVariable(dataKey, 0) };
  }

  // Multiple colors: create linear gradient with evenly distributed stops
  const stops = Array.from({ length: colorsCount }, (_, index) => {
    const offset = (index / (colorsCount - 1)) * 100;
    return `${getChartColorVariable(dataKey, index)} ${offset}%`;
  }).join(", ");

  return { background: `linear-gradient(to right, ${stops})` };
}

const ChartTooltip = ({
  animationDuration = 200,
  ...props
}: React.ComponentProps<typeof RechartsPrimitive.Tooltip>) => (
  <RechartsPrimitive.Tooltip animationDuration={animationDuration} {...props} />
);

export { ChartTooltip, ChartTooltipContent };
