import { useChart } from "@repo/design-system/components/evilcharts/ui/chart";
import { getChartPayloadStringValue } from "@repo/design-system/components/evilcharts/ui/chart-payload";
import { LegendItem } from "@repo/design-system/components/evilcharts/ui/legend-item";
import { cn } from "@repo/design-system/lib/utils";
import type * as React from "react";
import { type DefaultLegendContentProps, Legend } from "recharts";

type ChartLegendVariant =
  | "square"
  | "circle"
  | "circle-outline"
  | "rounded-square"
  | "rounded-square-outline"
  | "vertical-bar"
  | "horizontal-bar";

type LegendPayloadItem = NonNullable<
  DefaultLegendContentProps["payload"]
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
} & DefaultLegendContentProps) {
  const { config } = useChart();

  if (!payload?.length) {
    return null;
  }

  const items = new Map<string, LegendPayloadItem>();
  for (const item of payload) {
    if (item.type === "none") {
      continue;
    }

    const itemKey = getLegendItemKey(item, nameKey);
    if (!items.has(itemKey)) {
      items.set(itemKey, item);
    }
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
      {Array.from(items, ([itemKey, item]) => (
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
      ))}
    </div>
  );
}

const ChartLegend = Legend;

export { ChartLegend, ChartLegendContent, type ChartLegendVariant };
