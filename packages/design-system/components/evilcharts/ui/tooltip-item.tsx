import {
  type ChartConfig,
  getChartColorVariable,
  getColorsCount,
  getPayloadConfigEntry,
} from "@repo/design-system/components/evilcharts/ui/chart-config";
import { getChartPayloadStringValue } from "@repo/design-system/components/evilcharts/ui/chart-payload";
import { cn } from "@repo/design-system/lib/utils";
import type * as React from "react";
import type * as RechartsPrimitive from "recharts";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";

type TooltipIndicator = "line" | "dot" | "dashed";
type TooltipPayload = NonNullable<
  RechartsPrimitive.DefaultTooltipContentProps<ValueType, NameType>["payload"]
>;
type TooltipPayloadItem = TooltipPayload[number];
type TooltipFormatter = RechartsPrimitive.DefaultTooltipContentProps<
  ValueType,
  NameType
>["formatter"];

interface TooltipLabelProps {
  config: ChartConfig;
  hideLabel: boolean;
  label: React.ReactNode;
  labelClassName: string | undefined;
  labelFormatter:
    | RechartsPrimitive.DefaultTooltipContentProps<
        ValueType,
        NameType
      >["labelFormatter"]
    | undefined;
  labelKey: string | undefined;
  payload: TooltipPayload;
}

interface TooltipItemProps {
  config: ChartConfig;
  formatter: TooltipFormatter;
  hideIndicator: boolean;
  index: number;
  indicator: TooltipIndicator;
  item: TooltipPayloadItem;
  labelProps: TooltipLabelProps;
  nameKey: string | undefined;
  nestLabel: boolean;
  selected: string | null | undefined;
}

/** Renders the configured icon or series indicator for one tooltip row. */
function TooltipItemIndicator({
  colorsCount,
  dataKey,
  fill,
  hideIndicator,
  indicator,
  itemConfig,
  nestLabel,
}: {
  colorsCount: number;
  dataKey: string;
  fill: string | undefined;
  hideIndicator: boolean;
  indicator: TooltipIndicator;
  itemConfig: ChartConfig[string] | undefined;
  nestLabel: boolean;
}) {
  if (itemConfig?.icon) {
    const Icon = itemConfig.icon;
    return <Icon />;
  }

  if (hideIndicator) {
    return null;
  }

  return (
    <div
      className={cn("shrink-0 rounded-[2px]", {
        "h-2.5 w-2.5": indicator === "dot",
        "w-1": indicator === "line",
        "w-0 border-[1.5px] border-dashed bg-transparent!":
          indicator === "dashed",
        "my-0.5": nestLabel && indicator === "dashed",
      })}
      style={getIndicatorColorStyle(dataKey, colorsCount, fill)}
    />
  );
}

/** Renders one visible Recharts tooltip payload item. */
function TooltipItem({
  config,
  formatter,
  hideIndicator,
  index,
  indicator,
  item,
  labelProps,
  nameKey,
  nestLabel,
  selected,
}: TooltipItemProps) {
  if (item.type === "none") {
    return null;
  }

  // Pie charts use item.name. Radial charts use item.payload[nameKey].
  // Other charts use item.name or item.dataKey.
  const payloadName = getChartPayloadStringValue(item.payload, nameKey);
  const key = `${payloadName ?? item.name ?? item.dataKey ?? "value"}`;
  const configEntry = getPayloadConfigEntry(config, item, key);
  const itemConfig = configEntry?.config;
  const dataKey = configEntry?.dataKey ?? key;
  const payloadFill = getChartPayloadStringValue(item.payload, "fill");
  const colorsCount = itemConfig ? getColorsCount(itemConfig) : 1;
  const isDeemphasized = selected != null && selected !== dataKey;

  return (
    <div
      className={cn(
        "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
        indicator === "dot" && "items-center",
        isDeemphasized && "text-muted-foreground"
      )}
    >
      {formatter && item.value !== undefined && item.name ? (
        formatter(item.value, item.name, item, index, item.payload)
      ) : (
        <>
          <TooltipItemIndicator
            colorsCount={colorsCount}
            dataKey={dataKey}
            fill={payloadFill}
            hideIndicator={hideIndicator}
            indicator={indicator}
            itemConfig={itemConfig}
            nestLabel={nestLabel}
          />
          <div
            className={cn(
              "flex flex-1 justify-between gap-4 leading-none",
              nestLabel ? "items-end" : "items-center"
            )}
          >
            <div className="grid gap-1.5">
              {nestLabel ? <TooltipLabel {...labelProps} /> : null}
              <span className="text-muted-foreground">
                {itemConfig?.label ?? item.name}
              </span>
            </div>
            {item.value == null ? null : (
              <span
                className={cn(
                  "font-medium font-mono tabular-nums",
                  isDeemphasized ? "text-muted-foreground" : "text-foreground"
                )}
              >
                {typeof item.value === "number"
                  ? item.value.toLocaleString()
                  : String(item.value)}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Renders the formatted tooltip label when it is visible. */
function TooltipLabel({
  config,
  hideLabel,
  label,
  labelClassName,
  labelFormatter,
  labelKey,
  payload,
}: TooltipLabelProps) {
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

  const stops = Array.from({ length: colorsCount }, (_, index) => {
    const offset = (index / (colorsCount - 1)) * 100;
    return `${getChartColorVariable(dataKey, index)} ${offset}%`;
  }).join(", ");

  return { background: `linear-gradient(to right, ${stops})` };
}

export {
  type TooltipIndicator,
  TooltipItem,
  TooltipLabel,
  type TooltipLabelProps,
};
