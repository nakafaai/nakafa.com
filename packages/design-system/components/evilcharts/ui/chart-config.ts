import type * as React from "react";

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const;

type ThemeKey = keyof typeof THEMES;

// All Keys are optional at first
type ThemeColorsBase = {
  [K in ThemeKey]?: string[];
};

// Require at least one theme key
type AtLeastOneThemeColor = {
  [K in ThemeKey]: Required<Pick<ThemeColorsBase, K>> &
    Partial<Omit<ThemeColorsBase, K>>;
}[ThemeKey];

const VALID_THEME_KEYS = Object.keys(THEMES) as ThemeKey[];
const CHART_KEY_SAFE_CHAR_PATTERN = /^[A-Za-z0-9_-]$/;

export type ChartConfig = Record<
  string,
  {
    label?: React.ReactNode;
    icon?: React.ComponentType;
    colors?: AtLeastOneThemeColor;
  }
>;

// Validation for chart config colors at runtime
function validateChartConfigColors(config: ChartConfig): void {
  for (const [key, value] of Object.entries(config)) {
    if (value.colors) {
      const hasValidThemeKey = VALID_THEME_KEYS.some(
        (themeKey) => value.colors?.[themeKey] !== undefined
      );

      if (!hasValidThemeKey) {
        throw new Error(
          `[EvilCharts] Invalid chart config for "${key}": colors object must have at least one theme key (${VALID_THEME_KEYS.join(", ")}). Received empty object or invalid keys.`
        );
      }
    }
  }
}

// Distribute colors evenly across slots, extra slots go to last color(s)
// Example: 2 colors for 4 slots -> [red, red, pink, pink]
// Example: 3 colors for 4 slots -> [red, pink, blue, blue]
function distributeColors(colorsArray: string[], maxCount: number): string[] {
  const availableCount = colorsArray.length;
  if (availableCount >= maxCount) {
    return colorsArray.slice(0, maxCount);
  }

  const result: string[] = [];
  const baseSlots = Math.floor(maxCount / availableCount);
  const extraSlots = maxCount % availableCount;

  // First (availableCount - extraSlots) colors get baseSlots each.
  // Last extraSlots colors get (baseSlots + 1) each.
  for (let colorIndex = 0; colorIndex < availableCount; colorIndex++) {
    const isExtraColor = colorIndex >= availableCount - extraSlots;
    const slotsForThisColor = baseSlots + (isExtraColor ? 1 : 0);
    for (let slot = 0; slot < slotsForThisColor; slot++) {
      result.push(colorsArray[colorIndex]);
    }
  }

  return result;
}

/** Converts a chart series key into a stable CSS and SVG identifier suffix. */
function getChartKeySuffix(key: string) {
  return Array.from(key, (character) => {
    if (CHART_KEY_SAFE_CHAR_PATTERN.test(character)) {
      return character;
    }

    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) {
      return "";
    }

    return `_${codePoint.toString(16)}_`;
  }).join("");
}

/** Returns the scoped CSS custom property name for one chart color stop. */
function getChartColorVariableName(dataKey: string, index: number) {
  return `--color-${getChartKeySuffix(dataKey)}-${index}`;
}

/** Returns a CSS variable reference for one chart color stop. */
function getChartColorVariable(
  dataKey: string,
  index: number,
  fallbackIndex?: number
) {
  const variableName = getChartColorVariableName(dataKey, index);

  if (fallbackIndex === undefined) {
    return `var(${variableName})`;
  }

  return `var(${variableName}, var(${getChartColorVariableName(dataKey, fallbackIndex)}))`;
}

/** Returns a stable SVG definition id for a chart series part. */
function getChartSeriesId(id: string, part: string, dataKey: string) {
  return `${id}-${part}-${getChartKeySuffix(dataKey)}`;
}

/** Returns a solid color for single-color series and an SVG paint server for gradients. */
function getChartSeriesPaint(
  id: string,
  part: string,
  dataKey: string,
  colorsCount: number
) {
  if (colorsCount <= 1) {
    return getChartColorVariable(dataKey, 0);
  }

  return `url(#${getChartSeriesId(id, part, dataKey)})`;
}

// Helper to extract item config from a payload.
function getPayloadConfigFromPayload(
  config: ChartConfig,
  payload: unknown,
  key: string
) {
  if (typeof payload !== "object" || payload === null) {
    return;
  }

  const payloadPayload =
    "payload" in payload &&
    typeof payload.payload === "object" &&
    payload.payload !== null
      ? payload.payload
      : undefined;

  let configLabelKey: string = key;

  if (
    key in payload &&
    typeof payload[key as keyof typeof payload] === "string"
  ) {
    configLabelKey = payload[key as keyof typeof payload] as string;
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key as keyof typeof payloadPayload] === "string"
  ) {
    configLabelKey = payloadPayload[
      key as keyof typeof payloadPayload
    ] as string;
  }

  return configLabelKey in config ? config[configLabelKey] : config[key];
}

// Format values to percent for expanded charts
function axisValueToPercentFormatter(value: number) {
  return `${Math.round(value * 100).toFixed(0)}%`;
}

// Get max colors count across all themes for a config entry
function getColorsCount(config: ChartConfig[string]): number {
  if (!config.colors) {
    return 1;
  }
  const counts = VALID_THEME_KEYS.map(
    (theme) => config.colors?.[theme]?.length ?? 0
  );
  return Math.max(...counts, 1);
}

// Generate random loading data for skeleton/loading state
// min/max represent percentage of the range (0-100), defaults to 20-80 for realistic look
const getLoadingData = (points = 10, min = 0, max = 70) => {
  const range = max - min;
  return Array.from({ length: points }, () => ({
    loading: Math.floor(Math.random() * range) + min,
  }));
};

export {
  axisValueToPercentFormatter,
  distributeColors,
  getChartColorVariable,
  getChartColorVariableName,
  getChartSeriesId,
  getChartSeriesPaint,
  getColorsCount,
  getLoadingData,
  getPayloadConfigFromPayload,
  THEMES,
  validateChartConfigColors,
};
