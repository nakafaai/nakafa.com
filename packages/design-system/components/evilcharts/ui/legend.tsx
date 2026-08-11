import { useChart } from "@repo/design-system/components/evilcharts/ui/chart";
import { getChartPayloadStringValue } from "@repo/design-system/components/evilcharts/ui/chart-payload";
import { LegendItem } from "@repo/design-system/components/evilcharts/ui/legend-item";
import { cn } from "@repo/design-system/lib/utils";
import type * as React from "react";
import * as RechartsPrimitive from "recharts";

type ChartLegendVariant =
  | "square"
  | "circle"
  | "circle-outline"
  | "rounded-square"
  | "rounded-square-outline"
  | "vertical-bar"
  | "horizontal-bar";

type LegendPayloadItem = NonNullable<
  RechartsPrimitive.DefaultLegendContentProps["payload"]
>[number];

/** Resolves the stable key used by one Recharts legend payload item. */
function getLegendItemKey(item: LegendPayloadItem, nameKey?: string) {
  const payloadName = getChartPayloadStringValue(item.payload, nameKey);
  return `${payloadName ?? item.value ?? item.dataKey ?? "value"}`;
}

function ChartLegendContent({
  className,
  hideIcon = false,
  nameKey,
  payload,
  verticalAlign,
  align = "right",
  selected,
  onSelectChange,
  isClickable,
  variant = "rounded-square",
}: React.ComponentProps<"div"> & {
  hideIcon?: boolean;
  nameKey?: string;
  selected?: string | null;
  isClickable?: boolean;
  onSelectChange?: (selected: string | null) => void;
  variant?: ChartLegendVariant;
} & RechartsPrimitive.DefaultLegendContentProps) {
  const { config } = useChart();

  if (!payload?.length) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex select-none items-center gap-4",
        align === "left" && "justify-start",
        align === "center" && "justify-center",
        align === "right" && "justify-end",
        verticalAlign === "top" ? "pb-4" : "pt-4",
        className
      )}
    >
      {payload.map((item) => {
        if (item.type === "none") {
          return null;
        }

        const itemKey = getLegendItemKey(item, nameKey);
        return (
          <LegendItem
            config={config}
            hideIcon={hideIcon}
            isClickable={isClickable}
            item={item}
            itemKey={itemKey}
            key={itemKey}
            onSelectChange={onSelectChange}
            selected={selected}
            variant={variant}
          />
        );
      })}
    </div>
  );
}

const ChartLegend = RechartsPrimitive.Legend;

export { ChartLegend, ChartLegendContent, type ChartLegendVariant };
