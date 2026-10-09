import type { ChartContainerProps } from "@repo/design-system/components/evilcharts/ui/chart";
import { getChartPayloadStringValue } from "@repo/design-system/components/evilcharts/ui/chart-payload";
import {
  Array as Arr,
  MutableList,
  Predicate,
  Record as Rec,
  Schema,
} from "effect";

// Format: { THEME_NAME: CSS_SELECTOR }
const THEMES = { light: "", dark: ".dark" } as const;

type ThemeKey = keyof typeof THEMES;

// All Keys are optional at first
type ThemeColorsBase = {
  [K in ThemeKey]?: string[];
};

// Require at least one theme key
export type AtLeastOneThemeColor = {
  [K in ThemeKey]: Required<Pick<ThemeColorsBase, K>> &
    Partial<Omit<ThemeColorsBase, K>>;
}[ThemeKey];

const ChartConfigValidationInputSchema = Schema.Record(
  Schema.String,
  Schema.Struct({
    colors: Schema.optionalKey(
      Schema.Record(Schema.String, Schema.Array(Schema.String))
    ),
  })
);
type ChartConfigValidationInput = typeof ChartConfigValidationInputSchema.Type;

function isThemeKey(key: string): key is ThemeKey {
  return key in THEMES;
}

const VALID_THEME_KEYS = Arr.filter(Rec.keys(THEMES), isThemeKey);
const CHART_KEY_SAFE_CHAR_PATTERN = /^[A-Za-z0-9_-]$/;

export type ChartConfig = ChartContainerProps["config"];

// Validation for chart config colors at runtime
function validateChartConfigColors(config: ChartConfigValidationInput): void {
  for (const [key, value] of Rec.toEntries(config)) {
    const { colors } = value;

    if (colors) {
      const hasValidThemeKey = Arr.some(
        VALID_THEME_KEYS,
        (themeKey) => themeKey in colors
      );

      if (!hasValidThemeKey) {
        throw new Error(
          `[EvilCharts] Invalid chart config for "${key}": colors object must have at least one theme key (${Arr.join(VALID_THEME_KEYS, ", ")}). Received empty object or invalid keys.`
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

  const result = MutableList.make<string>();
  const baseSlots = Math.floor(maxCount / availableCount);
  const extraSlots = maxCount % availableCount;

  // First (availableCount - extraSlots) colors get baseSlots each.
  // Last extraSlots colors get (baseSlots + 1) each.
  for (let colorIndex = 0; colorIndex < availableCount; colorIndex += 1) {
    const isExtraColor = colorIndex >= availableCount - extraSlots;
    const slotsForThisColor = baseSlots + (isExtraColor ? 1 : 0);
    for (let slot = 0; slot < slotsForThisColor; slot += 1) {
      MutableList.append(result, colorsArray[colorIndex]);
    }
  }

  return MutableList.toArray(result);
}

/** Converts a chart series key into a stable CSS and SVG identifier suffix. */
function getChartKeySuffix(key: string) {
  return Arr.join(
    Array.from(key, (character) => {
      if (CHART_KEY_SAFE_CHAR_PATTERN.test(character)) {
        return character;
      }

      const codePoint = Number(character.codePointAt(0));
      return `_${codePoint.toString(16)}_`;
    }),
    ""
  );
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

function getConfigEntry(config: ChartConfig, key: unknown) {
  if (typeof key !== "string") {
    return;
  }

  return key in config
    ? {
        config: config[key],
        dataKey: key,
      }
    : undefined;
}

/**
 * Resolves the chart config entry for one Recharts payload item.
 */
function getPayloadConfigEntry(
  config: ChartConfig,
  payload: unknown,
  key: string
) {
  if (!Predicate.isReadonlyObject(payload)) {
    return getConfigEntry(config, key);
  }

  const payloadDataKeyEntry = getConfigEntry(config, payload.dataKey);
  if (payloadDataKeyEntry) {
    return payloadDataKeyEntry;
  }

  const keyEntry = getConfigEntry(config, key);
  if (keyEntry) {
    return keyEntry;
  }

  const payloadValueEntry = getConfigEntry(
    config,
    getChartPayloadStringValue(payload, key)
  );
  if (payloadValueEntry) {
    return payloadValueEntry;
  }

  return getConfigEntry(
    config,
    getChartPayloadStringValue(payload.payload, key)
  );
}

// Format values to percent for expanded charts
function axisValueToPercentFormatter(value: number) {
  return `${Math.round(value * 100).toFixed(0)}%`;
}

// Get max colors count across all themes for a config entry
function getColorsCount(config: ChartConfig[string]): number {
  const { colors } = config;

  if (!colors) {
    return 1;
  }

  const counts = Arr.map(
    VALID_THEME_KEYS,
    (theme) => colors[theme]?.length ?? 0
  );
  return Math.max(...counts, 1);
}

/** Keeps placeholder heights stable during server prerendering and hydration. */
const getLoadingData = (points = 10, min = 0, max = 70) => {
  const range = max - min;
  return Array.from({ length: points }, (_, index) => ({
    loading: Math.floor((index % 2 === 0 ? 0.35 : 0.65) * range) + min,
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
  getPayloadConfigEntry,
  THEMES,
  validateChartConfigColors,
};
