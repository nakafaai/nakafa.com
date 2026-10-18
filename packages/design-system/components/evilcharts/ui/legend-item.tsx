import {
  type ChartConfig,
  getChartColorVariable,
  getColorsCount,
  getPayloadConfigEntry,
} from "@repo/design-system/components/evilcharts/ui/chart-config";
import type { ChartLegendVariant } from "@repo/design-system/components/evilcharts/ui/legend";
import { ChartSeriesCueIndicator } from "@repo/design-system/components/evilcharts/ui/series-cue-indicator";
import { cn } from "cn";
import { Array as Arr, Match } from "effect";
import type * as React from "react";
import { createContext, use } from "react";
import type * as RechartsPrimitive from "recharts";

type LegendPayloadItem = NonNullable<
  RechartsPrimitive.DefaultLegendContentProps["payload"]
>[number];

/** Options that the chart legend shares with each of its items. */
interface LegendItemOptions {
  isClickable: boolean | undefined;
  onSelectChange: ((selected: string | null) => void) | undefined;
  selected: string | null | undefined;
  variant: ChartLegendVariant | undefined;
}

/** Provided by the legend part of each chart, read by every legend item. */
const LegendItemContext = createContext<LegendItemOptions | null>(null);

// Selects one option of the legend, throwing a helpful error when used outside a chart legend
function useLegendItem<T>(selector: (options: LegendItemOptions) => T) {
  const options = use(LegendItemContext);

  if (!options) {
    throw new Error("Legend items must be used within a chart legend");
  }

  return selector(options);
}

const DEFAULT_LEGEND_VARIANT: ChartLegendVariant = "rounded-square";

interface LegendItemProps {
  config: ChartConfig;
  item: LegendPayloadItem;
  itemKey: string;
}

/** Renders one selectable or read-only legend payload item. */
function LegendItem({ config, item, itemKey }: LegendItemProps) {
  const isClickable = useLegendItem((options) => options.isClickable);
  const onSelectChange = useLegendItem((options) => options.onSelectChange);
  const selected = useLegendItem((options) => options.selected);

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
        <LegendIndicator
          colorsCount={colorsCount}
          dataKey={dataKey}
          itemConfig={itemConfig}
        />
        {itemConfig?.label}
      </button>
    );
  }

  return (
    <div className={itemClassName}>
      <LegendIndicator
        colorsCount={colorsCount}
        dataKey={dataKey}
        itemConfig={itemConfig}
      />
      {itemConfig?.label}
    </div>
  );
}

/** Renders the configured icon, cue, or default legend indicator of one series. */
function LegendIndicator({
  colorsCount,
  dataKey,
  itemConfig,
}: {
  colorsCount: number;
  dataKey: string;
  itemConfig: ChartConfig[string] | undefined;
}) {
  const variant = useLegendItem(
    (options) => options.variant ?? DEFAULT_LEGEND_VARIANT
  );

  if (itemConfig?.icon) {
    const Icon = itemConfig.icon;
    return <Icon />;
  }

  if (itemConfig?.cue) {
    return <ChartSeriesCueIndicator cue={itemConfig.cue} dataKey={dataKey} />;
  }

  const fillStyle = getLegendFillStyle(dataKey, colorsCount);
  const outlineStyle = getLegendOutlineStyle(dataKey, colorsCount);

  return Match.value(variant).pipe(
    Match.when("square", () => (
      <div className="h-2 w-2 shrink-0" style={fillStyle} />
    )),
    Match.when("circle", () => (
      <div className="h-2 w-2 shrink-0 rounded-full" style={fillStyle} />
    )),
    Match.when("circle-outline", () => (
      <div
        className="h-2.5 w-2.5 shrink-0 rounded-full p-[1.5px]"
        style={outlineStyle}
      />
    )),
    Match.when("vertical-bar", () => (
      <div className="h-3 w-1 shrink-0 rounded-xs" style={fillStyle} />
    )),
    Match.when("horizontal-bar", () => (
      <div className="h-1 w-3 shrink-0 rounded-xs" style={fillStyle} />
    )),
    Match.when("rounded-square-outline", () => (
      <div
        className="h-2.5 w-2.5 shrink-0 rounded-[3px] p-[1.5px]"
        style={outlineStyle}
      />
    )),
    Match.orElse(() => (
      <div className="h-2 w-2 shrink-0 rounded-xs" style={fillStyle} />
    ))
  );
}

/** Solid fill or gradient background for filled variants. */
function getLegendFillStyle(
  dataKey: string,
  colorsCount: number
): React.CSSProperties {
  if (colorsCount <= 1) {
    return { backgroundColor: getChartColorVariable(dataKey, 0) };
  }

  const stops = Arr.join(
    Array.from({ length: colorsCount }, (_, index) => {
      const offset = (index / (colorsCount - 1)) * 100;
      return `${getChartColorVariable(dataKey, index)} ${offset}%`;
    }),
    ", "
  );

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

  const stops = Arr.join(
    Array.from({ length: colorsCount }, (_, index) => {
      const offset = (index / (colorsCount - 1)) * 100;
      return `${getChartColorVariable(dataKey, index)} ${offset}%`;
    }),
    ", "
  );

  return {
    background: `linear-gradient(to right, ${stops})`,
    ...maskStyle,
  };
}

export { LegendItem, LegendItemContext, type LegendItemOptions };
