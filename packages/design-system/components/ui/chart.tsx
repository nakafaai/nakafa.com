"use client";

import { cn } from "@repo/design-system/lib/utils";
import {
  type ComponentProps,
  type ComponentType,
  createContext,
  lazy,
  type ReactNode,
  Suspense,
  use,
  useId,
  useMemo,
} from "react";
import type {
  DefaultLegendContentProps,
  DefaultTooltipContentProps,
  TooltipContentProps,
  TooltipPayload,
  TooltipPayloadEntry,
} from "recharts";

const CHART_THEMES = [
  { name: "light", selector: "" },
  { name: "dark", selector: ".dark" },
] as const;

const CHART_INITIAL_DIMENSION = { width: 320, height: 200 };
const CHART_COLOR_VARIABLE_CHARACTER = /^[a-zA-Z0-9_-]$/;

type ChartTheme = (typeof CHART_THEMES)[number]["name"];
type ThemeColors = Partial<Record<ChartTheme, readonly string[]>>;
type ChartColors = {
  [Theme in ChartTheme]: Required<Pick<ThemeColors, Theme>> &
    Partial<Omit<ThemeColors, Theme>>;
}[ChartTheme];
type LegendPayloadEntry = NonNullable<
  DefaultLegendContentProps["payload"]
>[number];
type ChartLegendVariant =
  | "circle"
  | "circle-outline"
  | "horizontal-bar"
  | "rounded-square"
  | "rounded-square-outline"
  | "square"
  | "vertical-bar";
type PayloadEntry = LegendPayloadEntry | TooltipPayloadEntry;
type RechartsModule = typeof import("recharts");
type RechartsChildren = ComponentProps<
  RechartsModule["ResponsiveContainer"]
>["children"];

const LazyArea = lazy(async () => ({
  default: (await import("recharts")).Area,
}));
const LazyAreaChart = lazy(async () => ({
  default: (await import("recharts")).AreaChart,
}));
const LazyBar = lazy(async () => ({ default: (await import("recharts")).Bar }));
const LazyBarChart = lazy(async () => ({
  default: (await import("recharts")).BarChart,
}));
const LazyCartesianGrid = lazy(async () => ({
  default: (await import("recharts")).CartesianGrid,
}));
const LazyComposedChart = lazy(async () => ({
  default: (await import("recharts")).ComposedChart,
}));
const LazyLabel = lazy(async () => ({
  default: (await import("recharts")).Label,
}));
const LazyLabelList = lazy(async () => ({
  default: (await import("recharts")).LabelList,
}));
const LazyLegend = lazy(async () => ({
  default: (await import("recharts")).Legend,
}));
const LazyLine = lazy(async () => ({
  default: (await import("recharts")).Line,
}));
const LazyLineChart = lazy(async () => ({
  default: (await import("recharts")).LineChart,
}));
const LazyReferenceLine = lazy(async () => ({
  default: (await import("recharts")).ReferenceLine,
}));
const LazyResponsiveContainer = lazy(async () => ({
  default: (await import("recharts")).ResponsiveContainer,
}));
const LazyScatter = lazy(async () => ({
  default: (await import("recharts")).Scatter,
}));
const LazyTooltip = lazy(async () => ({
  default: (await import("recharts")).Tooltip,
}));
const LazyXAxis = lazy(async () => ({
  default: (await import("recharts")).XAxis,
}));
const LazyYAxis = lazy(async () => ({
  default: (await import("recharts")).YAxis,
}));

export type ChartConfig = Record<
  string,
  {
    label?: ReactNode;
    icon?: ComponentType;
    colors?: ChartColors;
  }
>;

const ChartContext = createContext<{ config: ChartConfig } | null>(null);

/** Returns the scoped EvilCharts color variable for one config color slot. */
function getColorVariable(key: string, index: number) {
  return `var(${getColorVariableName(key, index)})`;
}

/** Builds safe CSS custom property names from arbitrary chart config keys. */
function getColorVariableName(key: string, index: number) {
  const safeKey = Array.from(key, getColorVariableSegment).join("");
  return `--color-${safeKey}-${index}`;
}

/** Keeps readable keys readable while escaping spaces and punctuation. */
function getColorVariableSegment(character: string) {
  if (CHART_COLOR_VARIABLE_CHARACTER.test(character)) {
    return character;
  }

  const codePoint = character.codePointAt(0);
  if (codePoint === undefined) {
    return "_";
  }

  return `_${codePoint.toString(16)}_`;
}

/** Reads the nearest chart config from the EvilCharts container. */
function useChart() {
  const context = use(ChartContext);

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }

  return context;
}

/**
 * Renders the shared EvilCharts/Recharts container and theme-scoped CSS vars.
 *
 * @see https://evilcharts.com/docs/installation
 * @see https://evilcharts.com/docs/chart-config
 */
function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: ComponentProps<"div"> & {
  config: ChartConfig;
  children: RechartsChildren;
}) {
  const uniqueId = useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;
  const contextValue = useMemo(() => ({ config }), [config]);

  validateChartConfig(config);

  return (
    <ChartContext.Provider value={contextValue}>
      <div
        className={cn(
          "flex aspect-square min-h-0 w-full justify-center text-xs sm:aspect-video [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-hidden [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line_[stroke='#ccc']]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-hidden [&_.recharts-surface]:outline-hidden",
          className
        )}
        data-chart={chartId}
        data-slot="chart"
        {...props}
      >
        <ChartStyle config={config} id={chartId} />
        <Suspense fallback={null}>
          <LazyResponsiveContainer
            className="min-h-0 w-full"
            initialDimension={CHART_INITIAL_DIMENSION}
          >
            {children}
          </LazyResponsiveContainer>
        </Suspense>
      </div>
    </ChartContext.Provider>
  );
}

/** Emits chart-scoped CSS color variables from EvilCharts chart config. */
function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const styleBlocks: string[] = [];

  for (const { name, selector } of CHART_THEMES) {
    const tokens: string[] = [];

    for (const [key, itemConfig] of Object.entries(config)) {
      const colors = itemConfig.colors?.[name];

      if (!colors?.length) {
        continue;
      }

      const distributedColors = distributeColors(
        colors,
        getColorsCount(itemConfig)
      );

      for (const [index, color] of distributedColors.entries()) {
        tokens.push(`  ${getColorVariableName(key, index)}: ${color};`);
      }
    }

    if (tokens.length > 0) {
      styleBlocks.push(
        `${selector} [data-chart=${id}] {\n${tokens.join("\n")}\n}`
      );
    }
  }

  if (!styleBlocks.length) {
    return null;
  }

  return <style>{styleBlocks.join("\n")}</style>;
}

/** Renders Recharts' tooltip primitive behind the shared lazy chart runtime. */
function ChartTooltip(props: ComponentProps<RechartsModule["Tooltip"]>) {
  return <LazyTooltip {...props} />;
}

/** Renders the shared EvilCharts tooltip content for Recharts payloads. */
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
  color,
  nameKey,
  labelKey,
}: Partial<
  Omit<
    TooltipContentProps,
    "formatter" | "label" | "labelFormatter" | "payload"
  >
> &
  ComponentProps<"div"> & {
    hideLabel?: boolean;
    hideIndicator?: boolean;
    indicator?: "line" | "dot" | "dashed";
    nameKey?: string;
    labelKey?: string;
    label?: DefaultTooltipContentProps["label"];
    labelFormatter?: DefaultTooltipContentProps["labelFormatter"];
    formatter?: TooltipContentProps["formatter"];
    payload?: TooltipPayload;
  }) {
  const { config } = useChart();

  if (!(active && payload?.length)) {
    return null;
  }

  const [labelItem] = payload;
  const labelConfigKey = `${labelKey || labelItem?.dataKey || labelItem?.name || "value"}`;
  const labelItemConfig = getPayloadConfigFromPayload(
    config,
    labelItem,
    labelConfigKey
  );
  const labelValue =
    !labelKey && typeof label === "string"
      ? config[label]?.label || label
      : labelItemConfig?.label;

  let tooltipLabel: ReactNode = null;
  if (!hideLabel && labelFormatter) {
    tooltipLabel = (
      <div className={cn("font-medium", labelClassName)}>
        {labelFormatter(labelValue, payload)}
      </div>
    );
  } else if (!hideLabel && labelValue) {
    tooltipLabel = (
      <div className={cn("font-medium", labelClassName)}>{labelValue}</div>
    );
  }

  const nestLabel = payload.length === 1 && indicator !== "dot";

  return (
    <div
      className={cn(
        "grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
        className
      )}
    >
      {!nestLabel && tooltipLabel}
      <div className="grid gap-1.5">
        {payload.map((item, index) => {
          const key = `${nameKey || item.name || item.dataKey || "value"}`;
          const configKey = getPayloadConfigKey(config, item, key);
          const itemConfig = configKey ? config[configKey] : undefined;
          const tooltipKey = `${key}-${item.graphicalItemId}`;
          const indicatorStyle = color
            ? { background: color, borderColor: color }
            : getTooltipIndicatorStyle(item, configKey || key, itemConfig);

          return (
            <div
              className={cn(
                "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                indicator === "dot" && "items-center"
              )}
              key={tooltipKey}
            >
              {formatter && item?.value !== undefined && item.name ? (
                formatter(item.value, item.name, item, index, payload)
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
                          "w-0 border-[1.5px] border-dashed bg-transparent":
                            indicator === "dashed",
                          "my-0.5": !!nestLabel && indicator === "dashed",
                        })}
                        style={indicatorStyle}
                      />
                    )
                  )}
                  <div
                    className={cn(
                      "flex flex-1 justify-between gap-2 leading-none",
                      nestLabel ? "items-end" : "items-center"
                    )}
                  >
                    <div className="grid gap-1.5">
                      {nestLabel ? tooltipLabel : null}
                      <span className="text-muted-foreground">
                        {itemConfig?.label || item.name}
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
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Renders Recharts' legend primitive behind the shared lazy chart runtime. */
function ChartLegend(props: ComponentProps<RechartsModule["Legend"]>) {
  return <LazyLegend {...props} />;
}

/** Renders Recharts' area primitive behind the shared lazy chart runtime. */
function ChartArea(props: ComponentProps<RechartsModule["Area"]>) {
  return <LazyArea {...props} />;
}

/** Renders Recharts' area chart primitive behind the shared lazy chart runtime. */
function ChartAreaChart(props: ComponentProps<RechartsModule["AreaChart"]>) {
  return <LazyAreaChart {...props} />;
}

/** Renders Recharts' bar primitive behind the shared lazy chart runtime. */
function ChartBar(props: ComponentProps<RechartsModule["Bar"]>) {
  return <LazyBar {...props} />;
}

/** Renders Recharts' bar chart primitive behind the shared lazy chart runtime. */
function ChartBarChart(props: ComponentProps<RechartsModule["BarChart"]>) {
  return <LazyBarChart {...props} />;
}

/** Renders Recharts' Cartesian grid primitive behind the shared lazy chart runtime. */
function ChartCartesianGrid(
  props: ComponentProps<RechartsModule["CartesianGrid"]>
) {
  return <LazyCartesianGrid {...props} />;
}

/** Renders Recharts' composed chart primitive behind the shared lazy chart runtime. */
function ChartComposedChart(
  props: ComponentProps<RechartsModule["ComposedChart"]>
) {
  return <LazyComposedChart {...props} />;
}

/** Renders Recharts' label primitive behind the shared lazy chart runtime. */
function ChartLabel(props: ComponentProps<RechartsModule["Label"]>) {
  return <LazyLabel {...props} />;
}

/** Renders Recharts' label list primitive behind the shared lazy chart runtime. */
function ChartLabelList(props: ComponentProps<RechartsModule["LabelList"]>) {
  return <LazyLabelList {...props} />;
}

/** Renders Recharts' line primitive behind the shared lazy chart runtime. */
function ChartLine(props: ComponentProps<RechartsModule["Line"]>) {
  return <LazyLine {...props} />;
}

/** Renders Recharts' line chart primitive behind the shared lazy chart runtime. */
function ChartLineChart(props: ComponentProps<RechartsModule["LineChart"]>) {
  return <LazyLineChart {...props} />;
}

/** Renders Recharts' reference line primitive behind the shared lazy chart runtime. */
function ChartReferenceLine(
  props: ComponentProps<RechartsModule["ReferenceLine"]>
) {
  return <LazyReferenceLine {...props} />;
}

/** Renders Recharts' scatter primitive behind the shared lazy chart runtime. */
function ChartScatter(props: ComponentProps<RechartsModule["Scatter"]>) {
  return <LazyScatter {...props} />;
}

/** Renders Recharts' X axis primitive behind the shared lazy chart runtime. */
function ChartXAxis(props: ComponentProps<RechartsModule["XAxis"]>) {
  return <LazyXAxis {...props} />;
}

/** Renders Recharts' Y axis primitive behind the shared lazy chart runtime. */
function ChartYAxis(props: ComponentProps<RechartsModule["YAxis"]>) {
  return <LazyYAxis {...props} />;
}

/** Renders the shared EvilCharts legend content for Recharts payloads. */
function ChartLegendContent({
  className,
  hideIcon = false,
  payload,
  verticalAlign = "bottom",
  nameKey,
  variant = "rounded-square",
}: ComponentProps<"div"> &
  DefaultLegendContentProps & {
    hideIcon?: boolean;
    nameKey?: string;
    variant?: ChartLegendVariant;
  }) {
  const { config } = useChart();

  if (!payload?.length) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-4",
        verticalAlign === "top" ? "pb-3" : "pt-3",
        className
      )}
    >
      {payload.map((item) => {
        if (item.type === "none") {
          return null;
        }

        const key = `${nameKey || item.value || item.dataKey || "value"}`;
        const configKey = getPayloadConfigKey(config, item, key);
        const itemConfig = configKey ? config[configKey] : undefined;
        const dataKey = configKey || key;
        let indicatorStyle = getLegendIndicatorStyle(item, dataKey, itemConfig);

        if (
          variant === "circle-outline" ||
          variant === "rounded-square-outline"
        ) {
          indicatorStyle = getLegendOutlineStyle(item, dataKey, itemConfig);
        }

        return (
          <div
            className={cn(
              "flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"
            )}
            key={key}
          >
            {itemConfig?.icon && !hideIcon ? (
              <itemConfig.icon />
            ) : (
              <div
                className={getLegendIndicatorClassName(variant)}
                style={indicatorStyle}
              />
            )}
            {itemConfig?.label || item.value}
          </div>
        );
      })}
    </div>
  );
}

/** Matches EvilCharts legend variants while keeping Recharts payload support. */
function getLegendIndicatorClassName(variant: ChartLegendVariant) {
  if (variant === "circle") {
    return "h-2 w-2 shrink-0 rounded-full";
  }

  if (variant === "circle-outline") {
    return "h-2.5 w-2.5 shrink-0 rounded-full p-[1.5px]";
  }

  if (variant === "horizontal-bar") {
    return "h-1 w-3 shrink-0 rounded-[2px]";
  }

  if (variant === "square") {
    return "h-2 w-2 shrink-0 rounded-none";
  }

  if (variant === "vertical-bar") {
    return "h-3 w-1 shrink-0 rounded-[2px]";
  }

  if (variant === "rounded-square-outline") {
    return "h-2.5 w-2.5 shrink-0 rounded-[3px] p-[1.5px]";
  }

  return "h-2 w-2 shrink-0 rounded-[2px]";
}

/** Finds the chart config entry that matches a Recharts payload item. */
function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: PayloadEntry,
  key: string
) {
  const configKey = getPayloadConfigKey(config, payload, key);
  return configKey ? config[configKey] : undefined;
}

/** Returns the config key that matches Recharts' data key before display names. */
function getPayloadConfigKey(
  config: ChartConfig,
  payload: PayloadEntry,
  key: string
) {
  const payloadPayload = getObject(Reflect.get(payload, "payload"));
  const dataKey = getString(Reflect.get(payload, "dataKey"));
  const name = getString(Reflect.get(payload, "name"));

  if (dataKey && dataKey in config) {
    return dataKey;
  }

  if (name && name in config) {
    return name;
  }

  const payloadValue = getString(Reflect.get(payload, key));
  const nestedPayloadValue = payloadPayload
    ? getString(Reflect.get(payloadPayload, key))
    : undefined;

  if (payloadValue && payloadValue in config) {
    return payloadValue;
  }

  if (nestedPayloadValue && nestedPayloadValue in config) {
    return nestedPayloadValue;
  }

  if (key in config) {
    return key;
  }
}

/** Returns object-shaped unknown values for Recharts payload boundaries. */
function getObject(value: unknown) {
  if (typeof value !== "object" || value === null) {
    return;
  }

  return value;
}

/** Reads Recharts row-level color payloads for data-driven bar colors. */
function getPayloadColor(payload: PayloadEntry) {
  const nestedPayload = getObject(Reflect.get(payload, "payload"));
  const nestedFill = nestedPayload
    ? getString(Reflect.get(nestedPayload, "fill"))
    : undefined;

  if (nestedFill) {
    return nestedFill;
  }

  return (
    getString(Reflect.get(payload, "fill")) ||
    getString(Reflect.get(payload, "color")) ||
    getString(Reflect.get(payload, "stroke"))
  );
}

/** Returns string values from Recharts' loose payload boundary. */
function getString(value: unknown) {
  if (typeof value !== "string" || !value) {
    return;
  }

  return value;
}

/** Validates chart configs early so a malformed colors object fails locally. */
function validateChartConfig(config: ChartConfig) {
  for (const [key, value] of Object.entries(config)) {
    if (!value.colors) {
      continue;
    }

    const hasTheme = CHART_THEMES.some(
      ({ name }) => value.colors?.[name]?.length
    );

    if (!hasTheme) {
      throw new Error(
        `[EvilCharts] Chart config "${key}" needs at least one theme color.`
      );
    }
  }
}

/** Counts the color slots needed for one chart config entry. */
function getColorsCount(config: ChartConfig[string]) {
  if (!config.colors) {
    return 1;
  }

  const counts = CHART_THEMES.map(
    ({ name }) => config.colors?.[name]?.length ?? 0
  );

  return Math.max(...counts, 1);
}

/** Distributes short color palettes across the longest theme palette. */
function distributeColors(colors: readonly string[], maxCount: number) {
  if (colors.length >= maxCount) {
    return colors.slice(0, maxCount);
  }

  const result: string[] = [];
  const baseSlots = Math.floor(maxCount / colors.length);
  const extraSlots = maxCount % colors.length;

  for (let colorIndex = 0; colorIndex < colors.length; colorIndex++) {
    const isExtraColor = colorIndex >= colors.length - extraSlots;
    const slotsForColor = baseSlots + (isExtraColor ? 1 : 0);

    for (let slot = 0; slot < slotsForColor; slot++) {
      result.push(colors[colorIndex]);
    }
  }

  return result;
}

/** Builds a solid or gradient indicator style from EvilCharts color slots. */
function getIndicatorStyle(dataKey: string, colorsCount: number) {
  if (colorsCount <= 1) {
    const color = getColorVariable(dataKey, 0);

    return {
      background: color,
      borderColor: color,
    };
  }

  const stops = Array.from({ length: colorsCount }, (_, index) => {
    const offset = (index / (colorsCount - 1)) * 100;
    return `${getColorVariable(dataKey, index)} ${offset}%`;
  }).join(", ");

  return {
    background: `linear-gradient(to right, ${stops})`,
    borderColor: getColorVariable(dataKey, 0),
  };
}

/** Uses config color slots when available, otherwise Recharts legend color. */
function getLegendIndicatorStyle(
  payload: LegendPayloadEntry,
  dataKey: string,
  config: ChartConfig[string] | undefined
) {
  if (config?.colors) {
    return getIndicatorStyle(dataKey, getColorsCount(config));
  }

  const color = getPayloadColor(payload);

  return {
    background: color,
    borderColor: color,
  };
}

/** Uses the EvilCharts mask approach so outline legend variants can show gradients. */
function getLegendOutlineStyle(
  payload: LegendPayloadEntry,
  dataKey: string,
  config: ChartConfig[string] | undefined
) {
  const maskStyle = {
    WebkitMask:
      "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
    WebkitMaskComposite: "xor",
    mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
    maskComposite: "exclude",
  };

  if (config?.colors) {
    return {
      ...getIndicatorStyle(dataKey, getColorsCount(config)),
      ...maskStyle,
    };
  }

  const color = getPayloadColor(payload);

  return {
    background: color,
    borderColor: color,
    ...maskStyle,
  };
}

/** Uses config color slots when available, otherwise Recharts payload color. */
function getTooltipIndicatorStyle(
  payload: TooltipPayloadEntry,
  dataKey: string,
  config: ChartConfig[string] | undefined
) {
  if (config?.colors) {
    return getIndicatorStyle(dataKey, getColorsCount(config));
  }

  const color = getPayloadColor(payload);

  return {
    background: color,
    borderColor: color,
  };
}

export {
  ChartArea,
  ChartAreaChart,
  ChartBar,
  ChartBarChart,
  ChartCartesianGrid,
  ChartComposedChart,
  ChartContainer,
  ChartLabel,
  ChartLabelList,
  ChartLegend,
  ChartLegendContent,
  ChartLine,
  ChartLineChart,
  ChartReferenceLine,
  ChartScatter,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
  ChartXAxis,
  ChartYAxis,
  getColorsCount,
  getColorVariable,
  useChart,
};
