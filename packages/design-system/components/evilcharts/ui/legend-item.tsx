import {
  type ChartConfig,
  getChartColorVariable,
  getColorsCount,
  getPayloadConfigEntry,
} from "@repo/design-system/components/evilcharts/ui/chart-config";
import type { ChartLegendVariant } from "@repo/design-system/components/evilcharts/ui/legend";
import { ChartSeriesCueIndicator } from "@repo/design-system/components/evilcharts/ui/series-cue-indicator";
import { cn } from "@repo/design-system/lib/utils";
import type * as React from "react";
import type * as RechartsPrimitive from "recharts";

type LegendPayloadItem = NonNullable<
  RechartsPrimitive.DefaultLegendContentProps["payload"]
>[number];

interface LegendItemProps {
  config: ChartConfig;
  hideIcon: boolean;
  isClickable: boolean | undefined;
  item: LegendPayloadItem;
  itemKey: string;
  onSelectChange: ((selected: string | null) => void) | undefined;
  selected: string | null | undefined;
  variant: ChartLegendVariant;
}

/** Renders the configured cue, icon, or default legend indicator. */
function LegendItemIndicator({
  colorsCount,
  dataKey,
  hideIcon,
  itemConfig,
  variant,
}: {
  colorsCount: number;
  dataKey: string;
  hideIcon: boolean;
  itemConfig: ChartConfig[string] | undefined;
  variant: ChartLegendVariant;
}) {
  if (itemConfig?.icon && !hideIcon) {
    const Icon = itemConfig.icon;
    return <Icon />;
  }

  if (itemConfig?.cue && !hideIcon) {
    return <ChartSeriesCueIndicator cue={itemConfig.cue} dataKey={dataKey} />;
  }

  return (
    <LegendIndicator
      colorsCount={colorsCount}
      dataKey={dataKey}
      variant={variant}
    />
  );
}

/** Renders one selectable or read-only legend payload item. */
function LegendItem({
  config,
  hideIcon,
  isClickable,
  item,
  itemKey,
  onSelectChange,
  selected,
  variant,
}: LegendItemProps) {
  if (item.type === "none") {
    return null;
  }

  // Pie charts use item.value. Radial charts use item.payload[nameKey].
  // Other charts use item.dataKey.
  const configEntry = getPayloadConfigEntry(config, item, itemKey);
  const itemConfig = configEntry?.config;
  const dataKey = configEntry?.dataKey ?? itemKey;
  const isSelected =
    selected === null || selected === undefined || selected === dataKey;
  const colorsCount = itemConfig ? getColorsCount(itemConfig) : 1;
  const itemClassName = cn(
    "flex items-center gap-1.5 transition-colors [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground",
    !isSelected && "text-muted-foreground",
    isClickable &&
      "cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
  );

  if (isClickable) {
    return (
      <button
        aria-pressed={selected === dataKey}
        className={itemClassName}
        onClick={() => onSelectChange?.(selected === dataKey ? null : dataKey)}
        type="button"
      >
        <LegendItemIndicator
          colorsCount={colorsCount}
          dataKey={dataKey}
          hideIcon={hideIcon}
          itemConfig={itemConfig}
          variant={variant}
        />
        {itemConfig?.label}
      </button>
    );
  }

  return (
    <div className={itemClassName}>
      <LegendItemIndicator
        colorsCount={colorsCount}
        dataKey={dataKey}
        hideIcon={hideIcon}
        itemConfig={itemConfig}
        variant={variant}
      />
      {itemConfig?.label}
    </div>
  );
}

function LegendIndicator({
  variant,
  dataKey,
  colorsCount,
}: {
  variant: ChartLegendVariant;
  dataKey: string;
  colorsCount: number;
}) {
  const fillStyle = getLegendFillStyle(dataKey, colorsCount);
  const outlineStyle = getLegendOutlineStyle(dataKey, colorsCount);

  switch (variant) {
    case "square":
      return <div className="h-2 w-2 shrink-0" style={fillStyle} />;
    case "circle":
      return (
        <div className="h-2 w-2 shrink-0 rounded-full" style={fillStyle} />
      );
    case "circle-outline":
      return (
        <div
          className="h-2.5 w-2.5 shrink-0 rounded-full p-[1.5px]"
          style={outlineStyle}
        />
      );
    case "vertical-bar":
      return (
        <div className="h-3 w-1 shrink-0 rounded-[2px]" style={fillStyle} />
      );
    case "horizontal-bar":
      return (
        <div className="h-1 w-3 shrink-0 rounded-[2px]" style={fillStyle} />
      );
    case "rounded-square-outline":
      return (
        <div
          className="h-2.5 w-2.5 shrink-0 rounded-[3px] p-[1.5px]"
          style={outlineStyle}
        />
      );
    default:
      return (
        <div className="h-2 w-2 shrink-0 rounded-[2px]" style={fillStyle} />
      );
  }
}

/** Solid fill or gradient background for filled variants. */
function getLegendFillStyle(
  dataKey: string,
  colorsCount: number
): React.CSSProperties {
  if (colorsCount <= 1) {
    return { backgroundColor: getChartColorVariable(dataKey, 0) };
  }

  const stops = Array.from({ length: colorsCount }, (_, index) => {
    const offset = (index / (colorsCount - 1)) * 100;
    return `${getChartColorVariable(dataKey, index)} ${offset}%`;
  }).join(", ");

  return { background: `linear-gradient(to right, ${stops})` };
}

/** Returns the masked border paint for outlined variants. */
function getLegendOutlineStyle(
  dataKey: string,
  colorsCount: number
): React.CSSProperties {
  const maskStyle: React.CSSProperties = {
    WebkitMask:
      "linear-gradient(oklch(1 0 0) 0 0) content-box, linear-gradient(oklch(1 0 0) 0 0)",
    WebkitMaskComposite: "xor",
    mask: "linear-gradient(oklch(1 0 0) 0 0) content-box, linear-gradient(oklch(1 0 0) 0 0)",
    maskComposite: "exclude",
  };

  if (colorsCount <= 1) {
    return {
      backgroundColor: getChartColorVariable(dataKey, 0),
      ...maskStyle,
    };
  }

  const stops = Array.from({ length: colorsCount }, (_, index) => {
    const offset = (index / (colorsCount - 1)) * 100;
    return `${getChartColorVariable(dataKey, index)} ${offset}%`;
  }).join(", ");

  return {
    background: `linear-gradient(to right, ${stops})`,
    ...maskStyle,
  };
}

export { LegendItem };
